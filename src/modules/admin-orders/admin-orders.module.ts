import { Module } from "@nestjs/common";
import { FulfillmentModule } from "../fulfillment/fulfillment.module";
import { AdminOrdersController } from "./admin-orders.controller";
import { AdminOrdersService } from "./admin-orders.service";

@Module({
  imports: [FulfillmentModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
})
export class AdminOrdersModule {}
