import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SkipThrottle } from "@nestjs/throttler";
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/current-user.decorator";
import { FulfillmentService } from "./fulfillment.service";
import { mapProviderStatus } from "./providers/http-print.provider";
import { mapPrintfulStatus } from "./providers/printful-print.provider";
import { PrintOrderStatus } from "./providers/print-provider.interface";

@ApiTags("fulfillment")
@Controller("fulfillment")
export class FulfillmentController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly config: ConfigService,
  ) {}

  @SkipThrottle()
  @Post("webhook")
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async webhook(
    @Body() body: Record<string, any>,
    @Headers("x-print-signature") signature?: string,
  ) {
    const secret = this.config.get<string>("print.webhookSecret");
    if (secret && signature !== secret) {
      throw new UnauthorizedException("Assinatura da estamparia invalida.");
    }

    return this.fulfillment.handleWebhook({
      externalId: body.external_id ?? body.externalId,
      providerOrderId: body.provider_order_id ?? body.providerOrderId,
      status: mapProviderStatus(body.status),
      trackingCode: body.tracking_code ?? body.trackingCode ?? null,
      trackingUrl: body.tracking_url ?? body.trackingUrl ?? null,
      raw: body,
    });
  }

  /**
   * Webhook da Printful (API v1). A Printful nao assina o payload, entao o
   * segredo vai na URL cadastrada: /fulfillment/webhook/printful?secret=...
   */
  @SkipThrottle()
  @Post("webhook/printful")
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async printfulWebhook(
    @Body() body: Record<string, any>,
    @Query("secret") secret?: string,
  ) {
    const expected = this.config.get<string>("print.webhookSecret");
    if (expected && secret !== expected) {
      throw new UnauthorizedException("Segredo do webhook invalido.");
    }

    const order = body?.data?.order;
    if (!order?.external_id) {
      return { received: true, matched: false };
    }

    const shipment = body.data.shipment;
    const byType: Record<string, PrintOrderStatus> = {
      package_shipped: "SHIPPED",
      order_failed: "ERROR",
      order_canceled: "ERROR",
      package_returned: "ERROR",
      order_put_hold: "QUEUED",
    };

    return this.fulfillment.handleWebhook({
      externalId: order.external_id,
      providerOrderId: order.id ? String(order.id) : undefined,
      status: byType[body.type] ?? mapPrintfulStatus(order.status),
      trackingCode: shipment?.tracking_number ?? null,
      trackingUrl: shipment?.tracking_url ?? null,
      raw: body,
    });
  }

  @Post(":orderNumber/dispatch")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Reenvia para a estamparia um pedido pago cujo envio falhou",
  })
  dispatch(@Param("orderNumber") orderNumber: string) {
    return this.fulfillment.redispatch(orderNumber.toUpperCase());
  }

  @Get(":orderNumber/sync")
  @ApiOperation({
    summary:
      "Consulta a estamparia e sincroniza o status (util no driver mock)",
  })
  sync(@Param("orderNumber") orderNumber: string) {
    return this.fulfillment.syncOrder(orderNumber.toUpperCase());
  }
}
