import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import {
  JwtAuthGuard,
  OptionalJwtGuard,
} from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  SessionId,
} from "../../common/decorators/current-user.decorator";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary: "Fecha o pedido e devolve a URL de pagamento do Mercado Pago",
  })
  checkout(
    @Body() dto: CreateOrderDto,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.orders.checkout({ userId, sessionId }, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Histórico de pedidos do usuário" })
  listMine(@CurrentUser("id") userId: string) {
    return this.orders.listMine(userId);
  }

  @Get(":number")
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: "Detalhe do pedido pelo número" })
  byNumber(
    @Param("number") number: string,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.orders.findByNumber(number, { userId, sessionId });
  }

  @Post(":number/cancel")
  @HttpCode(200)
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: "Cancela um pedido ainda não pago" })
  cancel(
    @Param("number") number: string,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.orders.cancel(number, { userId, sessionId });
  }
}
