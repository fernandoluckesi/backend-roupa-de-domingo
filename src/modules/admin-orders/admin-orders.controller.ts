import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/current-user.decorator";
import { AdminOrdersService } from "./admin-orders.service";
import { ListOrdersQueryDto, PrintLabelsDto, ProductionListQueryDto, UpdateFulfillmentDto } from "./dto/admin-orders.dto";

/** Backoffice: gestao de pedidos (toda chamada fica na trilha de auditoria pelo AuditInterceptor). */
@ApiTags("admin-orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get("orders/summary")
  @ApiOperation({ summary: "Contagens por status e faturamento (hoje e 30 dias)" })
  summary() {
    return this.orders.summary();
  }

  @Get("orders/production-list")
  @ApiOperation({ summary: "Lista de producao agregada por SKU" })
  productionList(@Query() query: ProductionListQueryDto) {
    return this.orders.productionList(query.stage ?? "to_produce");
  }

  @Post("orders/labels")
  @HttpCode(200)
  @ApiOperation({ summary: "Dados das etiquetas e da declaracao de conteudo (marca como impressas)" })
  labels(@Body() dto: PrintLabelsDto) {
    return this.orders.labels(dto.numbers);
  }

  @Get("orders")
  @ApiOperation({ summary: "Pedidos por etapa, busca e periodo" })
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Get("orders/:number")
  @ApiOperation({ summary: "Pedido completo, com dados de entrega" })
  detail(@Param("number") number: string) {
    return this.orders.detail(number);
  }

  @Patch("orders/:number/fulfillment")
  @ApiOperation({ summary: "Avanca a producao/envio, rastreio, embalagem e notas internas" })
  updateFulfillment(@Param("number") number: string, @Body() dto: UpdateFulfillmentDto) {
    return this.orders.updateFulfillment(number, dto);
  }

  @Post("orders/:number/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancela pedido ainda nao pago" })
  cancel(@Param("number") number: string) {
    return this.orders.cancel(number);
  }

  @Get("shipping/sender")
  @ApiOperation({ summary: "Remetente configurado para as etiquetas" })
  sender() {
    return this.orders.sender();
  }
}
