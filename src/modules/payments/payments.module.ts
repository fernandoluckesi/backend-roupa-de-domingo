import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { MercadoPagoService } from "./mercado-pago.service";
import { FulfillmentModule } from "../fulfillment/fulfillment.module";

@Module({
  imports: [FulfillmentModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoService],
  exports: [PaymentsService, MercadoPagoService],
})
export class PaymentsModule {}
