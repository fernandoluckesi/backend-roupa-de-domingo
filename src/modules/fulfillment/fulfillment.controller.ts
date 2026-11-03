import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FulfillmentService } from "./fulfillment.service";
import { mapProviderStatus } from "./providers/http-print.provider";

@ApiTags("fulfillment")
@Controller("fulfillment")
export class FulfillmentController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly config: ConfigService,
  ) {}

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

  @Get(":orderNumber/sync")
  @ApiOperation({
    summary:
      "Consulta a estamparia e sincroniza o status (util no driver mock)",
  })
  sync(@Param("orderNumber") orderNumber: string) {
    return this.fulfillment.syncOrder(orderNumber.toUpperCase());
  }
}
