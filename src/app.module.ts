import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
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
import { AdminOrdersModule } from "./modules/admin-orders/admin-orders.module";
import { AdminAuthModule } from "./modules/admin-auth/admin-auth.module";
import { EasterEggsModule } from "./modules/easter-eggs/easter-eggs.module";
import { MailModule } from "./modules/mail/mail.module";
import { PrivacyModule } from "./modules/privacy/privacy.module";
import { ContactModule } from "./modules/contact/contact.module";
import { ReturnsModule } from "./modules/returns/returns.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { SeoModule } from "./modules/seo/seo.module";
import { AuditInterceptor } from "./modules/audit/audit.interceptor";
import { AuditModule } from "./modules/audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    // Rate limit global (por IP): 120 req/min; rotas sensiveis tem limites proprios via @Throttle
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    MailModule,
    PrivacyModule,
    InvoicesModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CartModule,
    ShippingModule,
    OrdersModule,
    PaymentsModule,
    FulfillmentModule,
    AdminAuthModule,
    AdminOrdersModule,
    EasterEggsModule,
    ContactModule,
    ReturnsModule,
    SeoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
