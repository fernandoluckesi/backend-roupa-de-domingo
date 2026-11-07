import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { AuditCategory, AuditOutcome, OrderStatus, PaymentStatus, ReturnStatus, ReturnType, Role } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { MercadoPagoService } from "../payments/mercado-pago.service";
import { PaymentsModule } from "../payments/payments.module";
import { JwtAuthGuard, OptionalJwtGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser, Roles } from "../../common/decorators/current-user.decorator";
import { protocolNumber } from "../../common/utils/business-days.util";

/** CDC art. 49: 7 dias corridos do recebimento */
export const REGRET_DAYS = 7;
/** CDC art. 26, II: 90 dias para produto duravel (roupa, caneca, capa, garrafa) */
export const DEFECT_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Solicitação recebida",
  APPROVED: "Aprovada: use o código de postagem",
  REJECTED: "Não aprovada",
  IN_TRANSIT: "Produto a caminho",
  RECEIVED: "Produto recebido",
  REFUNDED: "Reembolsada",
  EXCHANGED: "Trocada",
};

class ReturnItemDto {
  @ApiProperty()
  @IsUUID()
  orderItemId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

class CreateReturnDto {
  @ApiProperty({ enum: ReturnType })
  @IsEnum(ReturnType)
  type: ReturnType;

  @ApiProperty()
  @IsString()
  @Length(5, 1000, { message: "Conte em poucas palavras o motivo (5 a 1000 caracteres)." })
  reason: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  @ArrayMinSize(1, { message: "Escolha ao menos um item." })
  items: ReturnItemDto[];

  @ApiPropertyOptional({ description: "Pedido de convidado: e-mail usado na compra" })
  @IsOptional()
  @IsEmail()
  email?: string;
}

class UpdateReturnDto {
  @ApiProperty({ enum: ReturnStatus })
  @IsEnum(ReturnStatus)
  status: ReturnStatus;

  @ApiPropertyOptional({ description: "Codigo de postagem reversa (Correios)" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reverseCode?: string;

  @ApiPropertyOptional({ description: "Mensagem ao cliente" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;
}

type Timeline = { status: string; at: string; note?: string }[];

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly mercadoPago: MercadoPagoService,
    private readonly audit: AuditService,
  ) {}

  /** Data de recebimento: evento DELIVERED da timeline (ou null se ainda nao entregue). */
  private deliveredAt(timeline: unknown): Date | null {
    const events = Array.isArray(timeline) ? (timeline as Timeline) : [];
    const delivered = [...events].reverse().find((e) => e.status === OrderStatus.DELIVERED);
    return delivered ? new Date(delivered.at) : null;
  }

  async create(orderNumber: string, dto: CreateReturnDto, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber.toUpperCase() },
      include: { items: true, returns: true },
    });
    const isOwner = order && (order.userId ? order.userId === userId : dto.email?.toLowerCase() === order.customerEmail);
    if (!order || !isOwner) throw new NotFoundException("Pedido nao encontrado.");

    const eligible: OrderStatus[] = [OrderStatus.PAID, OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED, OrderStatus.DELIVERED];
    if (!eligible.includes(order.status)) {
      throw new BadRequestException("Esse pedido não está pago; para desistir de um pedido pendente, basta cancelá-lo.");
    }

    const open = order.returns.find((r) => !["REJECTED", "REFUNDED", "EXCHANGED"].includes(r.status));
    if (open) {
      throw new BadRequestException(`Já existe a solicitação ${open.protocol} em andamento para esse pedido.`);
    }

    const delivered = this.deliveredAt(order.timeline);
    const now = Date.now();
    if (dto.type === ReturnType.REGRET && delivered && now - delivered.getTime() > REGRET_DAYS * DAY_MS) {
      throw new BadRequestException(
        `O prazo de arrependimento é de ${REGRET_DAYS} dias corridos a partir do recebimento. Se o produto tem defeito, escolha "Defeito".`,
      );
    }
    if (dto.type === ReturnType.DEFECT) {
      const reference = delivered ?? order.createdAt;
      if (now - reference.getTime() > DEFECT_DAYS * DAY_MS) {
        throw new BadRequestException(`O prazo para reclamar de defeito é de ${DEFECT_DAYS} dias a partir do recebimento.`);
      }
    }

    for (const item of dto.items) {
      const orderItem = order.items.find((i) => i.id === item.orderItemId);
      if (!orderItem) throw new BadRequestException("Item não pertence ao pedido.");
      if (item.quantity > orderItem.quantity) throw new BadRequestException("Quantidade maior que a comprada.");
    }

    const created = await this.prisma.returnRequest.create({
      data: {
        protocol: protocolNumber("DEV"),
        orderId: order.id,
        userId: order.userId,
        type: dto.type,
        reason: dto.reason.trim(),
        items: dto.items as object,
        timeline: [
          { status: ReturnStatus.REQUESTED, at: new Date().toISOString(), note: "Solicitação aberta pelo cliente" },
        ] as object,
      },
    });

    // Motivo em texto livre fica so na solicitacao (pode ter dado pessoal)
    this.audit.record({
      category: AuditCategory.RETURN,
      action: "return.requested",
      target: { type: "order", id: order.number },
      data: {
        protocol: created.protocol,
        type: dto.type,
        items: dto.items.length,
        units: dto.items.reduce((sum, item) => sum + item.quantity, 0),
        daysSinceDelivery: delivered ? Math.floor((now - delivered.getTime()) / DAY_MS) : null,
      },
    });
    void this.mail.sendReturnUpdate(order.customerEmail, order.customerName, {
      protocol: created.protocol,
      orderNumber: order.number,
      statusLabel: RETURN_STATUS_LABELS.REQUESTED,
      note: "Analisamos em até 2 dias úteis e enviamos o código de postagem reversa gratuita.",
    });
    return created;
  }

  list(orderNumber: string, userId?: string) {
    return this.prisma.returnRequest.findMany({
      where: { order: { number: orderNumber.toUpperCase(), ...(userId ? { userId } : { userId: null }) } },
      orderBy: { createdAt: "desc" },
    });
  }

  listAll() {
    return this.prisma.returnRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { order: { select: { number: true, customerName: true, totalCents: true, status: true } } },
    });
  }

  /** Admin: avanca o status. REFUNDED estorna no Mercado Pago (mesmo meio de pagamento). */
  async update(id: string, dto: UpdateReturnDto) {
    const request = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { items: true, payment: true } } },
    });
    if (!request) throw new NotFoundException("Solicitação não encontrada.");

    let refundCents: number | null = request.refundCents;
    let note = dto.resolution ?? null;

    if (dto.status === ReturnStatus.REFUNDED) {
      const items = request.items as { orderItemId: string; quantity: number }[];
      const itemsCents = items.reduce((sum, ri) => {
        const item = request.order.items.find((i) => i.id === ri.orderItemId);
        return sum + (item ? item.unitPriceCents * ri.quantity : 0);
      }, 0);
      const allItems = items.reduce((s, i) => s + i.quantity, 0) === request.order.items.reduce((s, i) => s + i.quantity, 0);
      // Arrependimento devolve tudo, inclusive o frete (entendimento do art. 49, paragrafo unico)
      refundCents = allItems
        ? request.order.totalCents
        : Math.min(request.order.totalCents, itemsCents - Math.round((request.order.discountCents * itemsCents) / Math.max(1, request.order.subtotalCents)));

      const payment = request.order.payment;
      if (payment?.providerPaymentId && this.mercadoPago.isConfigured && payment.provider === "mercadopago") {
        try {
          await this.mercadoPago.refundPayment(payment.providerPaymentId, `refund-${request.id}`, allItems ? undefined : refundCents);
        } catch (error) {
          this.logger.error(`Estorno falhou para ${request.protocol}: ${(error as Error).message}`);
          this.audit.record({
            category: AuditCategory.PAYMENT,
            action: "payment.refund_failed",
            outcome: AuditOutcome.FAILURE,
            target: { type: "order", id: request.order.number },
            data: { protocol: request.protocol, refundCents, error: (error as Error).message.slice(0, 300) },
          });
          throw new BadRequestException("O Mercado Pago recusou o estorno. Tente de novo ou estorne pelo painel do MP.");
        }
      }
      this.audit.record({
        category: AuditCategory.PAYMENT,
        action: "payment.refunded",
        target: { type: "order", id: request.order.number },
        data: {
          protocol: request.protocol,
          refundCents,
          full: allItems,
          viaProvider: Boolean(payment?.providerPaymentId && this.mercadoPago.isConfigured && payment.provider === "mercadopago"),
        },
      });
      if (allItems) {
        await this.prisma.order.update({ where: { id: request.orderId }, data: { status: OrderStatus.REFUNDED } });
        if (payment) await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } });
        this.audit.record({
          category: AuditCategory.ORDER,
          action: "order.status_changed",
          target: { type: "order", id: request.order.number },
          data: { from: request.order.status, to: OrderStatus.REFUNDED, source: "return", protocol: request.protocol },
        });
      }
      note = note ?? "Reembolso enviado para o mesmo meio de pagamento. No cartão, pode aparecer em até 2 faturas.";
    }

    const timeline = Array.isArray(request.timeline) ? (request.timeline as Timeline) : [];
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reverseCode: dto.reverseCode ?? request.reverseCode,
        resolution: dto.resolution ?? request.resolution,
        refundCents,
        timeline: [...timeline, { status: dto.status, at: new Date().toISOString(), note: note ?? undefined }] as object,
      },
    });

    this.audit.record({
      category: AuditCategory.RETURN,
      action: "return.status_changed",
      target: { type: "order", id: request.order.number },
      data: {
        protocol: request.protocol,
        from: request.status,
        to: dto.status,
        reverseCode: dto.reverseCode ?? null,
        refundCents: dto.status === ReturnStatus.REFUNDED ? refundCents : null,
      },
    });
    void this.mail.sendReturnUpdate(request.order.customerEmail, request.order.customerName, {
      protocol: request.protocol,
      orderNumber: request.order.number,
      statusLabel: RETURN_STATUS_LABELS[dto.status],
      note: [dto.reverseCode ? `Código de postagem reversa: ${dto.reverseCode}` : null, note].filter(Boolean).join("\n"),
    });
    return updated;
  }
}

@ApiTags("returns")
@Controller()
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post("orders/:number/returns")
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: "Solicita devolucao (arrependimento em 7 dias ou defeito em 90 dias)" })
  create(@Param("number") number: string, @Body() dto: CreateReturnDto, @CurrentUser("id") userId?: string) {
    return this.returns.create(number, dto, userId);
  }

  @Get("orders/:number/returns")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Solicitacoes de devolucao do pedido" })
  list(@Param("number") number: string, @CurrentUser("id") userId: string) {
    return this.returns.list(number, userId);
  }

  @Get("admin/returns")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Todas as solicitacoes de devolucao" })
  listAll() {
    return this.returns.listAll();
  }

  @Patch("admin/returns/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Atualiza status, codigo de postagem e reembolso" })
  update(@Param("id") id: string, @Body() dto: UpdateReturnDto) {
    return this.returns.update(id, dto);
  }
}

@Module({
  imports: [PaymentsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
