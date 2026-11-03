import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CartModule } from "./modules/cart/cart.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ShippingModule } from "./modules/shipping/shipping.module";
import { FulfillmentModule } from "./modules/fulfillment/fulfillment.module";
import { EasterEggsModule } from "./modules/easter-eggs/easter-eggs.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CartModule,
    ShippingModule,
    OrdersModule,
    PaymentsModule,
    FulfillmentModule,
    EasterEggsModule,
  ],
})
export class AppModule {}
