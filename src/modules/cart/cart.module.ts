import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { ShippingModule } from "../shipping/shipping.module";

@Module({
  imports: [ShippingModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
