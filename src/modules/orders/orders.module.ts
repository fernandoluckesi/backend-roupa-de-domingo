import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { CartModule } from "../cart/cart.module";
import { PaymentsModule } from "../payments/payments.module";
import { ShippingModule } from "../shipping/shipping.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [CartModule, PaymentsModule, ShippingModule, AnalyticsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
