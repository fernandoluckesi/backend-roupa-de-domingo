import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { AuditCategory, ContactStatus, Role } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { JwtAuthGuard, OptionalJwtGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser, Roles } from "../../common/decorators/current-user.decorator";
import { addBusinessDays, protocolNumber } from "../../common/utils/business-days.util";

export const CONTACT_SUBJECTS = [
  "pedido",
  "troca-devolucao",
  "pagamento",
  "privacidade",
  "direito-autoral",
  "outro",
] as const;

const SUBJECT_LABELS: Record<(typeof CONTACT_SUBJECTS)[number], string> = {
  pedido: "Pedido",
  "troca-devolucao": "Troca/devolução",
  pagamento: "Pagamento/reembolso",
  privacidade: "Privacidade (LGPD)",
  "direito-autoral": "Direito autoral/marca (notice and takedown)",
  outro: "Outro",
};

/** Prazo de resposta do SAC (Decreto 7.962/2013, art. 4o, paragrafo unico). */
const SAC_RESPONSE_BUSINESS_DAYS = 5;

class CreateContactDto {
  @ApiProperty()
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty()
  @IsEmail({}, { message: "E-mail invalido." })
  email: string;

  @ApiProperty({ enum: CONTACT_SUBJECTS })
  @IsIn(CONTACT_SUBJECTS as unknown as string[], { message: "Assunto invalido." })
  subject: (typeof CONTACT_SUBJECTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  orderNumber?: string;

  @ApiProperty()
  @IsString()
  @Length(10, 4000, { message: "A mensagem precisa ter entre 10 e 4000 caracteres." })
  message: string;
}

class UpdateContactDto {
  @ApiProperty({ enum: ContactStatus })
  @IsEnum(ContactStatus)
  status: ContactStatus;
}

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateContactDto, userId?: string) {
    const respondBy = addBusinessDays(new Date(), SAC_RESPONSE_BUSINESS_DAYS);
    const message = await this.prisma.contactMessage.create({
      data: {
        protocol: protocolNumber("SAC"),
        userId: userId ?? null,
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        subject: dto.subject,
        orderNumber: dto.orderNumber?.toUpperCase().trim() || null,
        message: dto.message.trim(),
        respondBy,
      },
    });

    const inbox = this.config.get<string>("mail.sacInbox", "sac@roupadedomingo.com.br");
    void this.mail.send({
      to: inbox,
      replyTo: message.email,
      subject: `[${message.protocol}] ${SUBJECT_LABELS[dto.subject]}${message.orderNumber ? ` · ${message.orderNumber}` : ""}`,
      text: [
        `Protocolo: ${message.protocol}`,
        `Responder até: ${respondBy.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
        `De: ${message.name} <${message.email}>`,
        `Assunto: ${SUBJECT_LABELS[dto.subject]}`,
        message.orderNumber ? `Pedido: ${message.orderNumber}` : "",
        "",
        message.message,
      ].join("\n"),
    });
    void this.mail.sendContactReceipt(message.email, message.name, message.protocol, respondBy);
    // Conteudo da mensagem fica so no atendimento; na trilha vai o protocolo e o assunto
    this.audit.record({
      category: AuditCategory.CONTACT,
      action: "contact.created",
      target: { type: "contact", id: message.protocol },
      data: { subject: dto.subject, orderNumber: message.orderNumber, guest: !userId },
    });

    return { protocol: message.protocol, respondBy: respondBy.toISOString() };
  }

  list(status?: ContactStatus) {
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { respondBy: "asc" }],
      take: 200,
    });
  }

  async update(protocol: string, status: ContactStatus) {
    const before = await this.prisma.contactMessage.findUnique({ where: { protocol }, select: { status: true } });
    const updated = await this.prisma.contactMessage.update({
      where: { protocol },
      data: { status, answeredAt: status === ContactStatus.OPEN ? null : new Date() },
    });
    this.audit.record({
      category: AuditCategory.CONTACT,
      action: "contact.status_changed",
      target: { type: "contact", id: protocol },
      data: { from: before?.status ?? null, to: status },
    });
    return updated;
  }
}

@ApiTags("contact")
@Controller()
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post("contact")
  @HttpCode(201)
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @ApiOperation({ summary: "Abre um atendimento no SAC (protocolo + prazo de 5 dias uteis)" })
  create(@Body() dto: CreateContactDto, @CurrentUser("id") userId?: string) {
    return this.contact.create(dto, userId);
  }

  @Get("admin/contact")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Fila do SAC ordenada pelo prazo" })
  list() {
    return this.contact.list();
  }

  @Patch("admin/contact/:protocol")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Atualiza o status de um atendimento" })
  update(@Param("protocol") protocol: string, @Body() dto: UpdateContactDto) {
    return this.contact.update(protocol, dto.status);
  }
}

@Module({
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
