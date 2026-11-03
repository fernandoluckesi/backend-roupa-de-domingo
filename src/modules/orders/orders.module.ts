import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { CartModule } from "../cart/cart.module";
import { PaymentsModule } from "../payments/payments.module";
import { ShippingModule } from "../shipping/shipping.module";

@Module({
  imports: [CartModule, PaymentsModule, ShippingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
