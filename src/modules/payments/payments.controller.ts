import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @SkipThrottle()
  @Post("webhook")
  @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(
    @Body() body: Record<string, any>,
    @Query() query: Record<string, any>,
    @Headers("x-signature") signature?: string,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.payments.handleMercadoPagoWebhook(body ?? {}, query ?? {}, {
      signature,
      requestId,
    });
  }

  @Get("config")
  @ApiOperation({ summary: "Informa qual driver de pagamento esta ativo" })
  config() {
    return {
      driver: this.payments.driver,
      simulated: this.payments.driver === "mock",
      message:
        this.payments.driver === "mock"
          ? "Sem credenciais do Mercado Pago: o checkout usa a tela simulada local."
          : "Checkout Pro ativo. O cliente e redirecionado para o Mercado Pago.",
    };
  }

  @Get(":orderNumber/status")
  @ApiOperation({ summary: "Status do pagamento de um pedido" })
  status(@Param("orderNumber") orderNumber: string) {
    return this.payments.getStatus(orderNumber);
  }

  @Post("mock/:orderNumber/approve")
  @HttpCode(200)
  @ApiOperation({ summary: "[mock] Aprova o pagamento manualmente" })
  approve(@Param("orderNumber") orderNumber: string) {
    return this.payments.simulate(orderNumber, "approve");
  }

  @Post("mock/:orderNumber/reject")
  @HttpCode(200)
  @ApiOperation({ summary: "[mock] Recusa o pagamento manualmente" })
  reject(@Param("orderNumber") orderNumber: string) {
    return this.payments.simulate(orderNumber, "reject");
  }

  @Post("mock/:orderNumber/pending")
  @HttpCode(200)
  @ApiOperation({ summary: "[mock] Deixa o pagamento pendente" })
  pending(@Param("orderNumber") orderNumber: string) {
    return this.payments.simulate(orderNumber, "pending");
  }
}
