-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE "Humor" AS ENUM ('ACIDO', 'SARCASTICO', 'EXISTENCIAL', 'ABSURDO', 'PASSIVO_AGRESSIVO');
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROCESS', 'REJECTED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "FulfillmentStatus" AS ENUM ('QUEUED', 'SENT', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "document" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "humorLevel" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Casa',
    "recipient" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "humor" "Humor" NOT NULL DEFAULT 'ACIDO',
    "basePriceCents" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "printProviderSku" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "model" TEXT,
    "priceCents" INTEGER NOT NULL,
    "weightGrams" INTEGER NOT NULL DEFAULT 300,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "printProviderVariantId" TEXT,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "couponId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "customText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "CouponType" NOT NULL DEFAULT 'PERCENT',
    "value" INTEGER NOT NULL DEFAULT 0,
    "minSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerDocument" TEXT,
    "shippingRecipient" TEXT NOT NULL,
    "shippingZipCode" TEXT NOT NULL,
    "shippingStreet" TEXT NOT NULL,
    "shippingNumber" TEXT NOT NULL,
    "shippingComplement" TEXT,
    "shippingDistrict" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingState" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "couponId" TEXT,
    "shippingMethod" TEXT NOT NULL DEFAULT 'economico',
    "estimatedDays" INTEGER NOT NULL DEFAULT 10,
    "trackingCode" TEXT,
    "notes" TEXT,
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "customText" TEXT,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercadopago',
    "preferenceId" TEXT,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "installments" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "initPoint" TEXT,
    "rawPayload" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerOrderId" TEXT,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'QUEUED',
    "trackingCode" TEXT,
    "trackingUrl" TEXT,
    "lastError" TEXT,
    "rawPayload" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "easter_eggs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "rewardCouponId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "easter_eggs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "easter_egg_discoveries" (
    "id" TEXT NOT NULL,
    "easterEggId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "easter_egg_discoveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX "products_humor_idx" ON "products"("humor");
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");
CREATE UNIQUE INDEX "carts_sessionId_key" ON "carts"("sessionId");
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");
CREATE UNIQUE INDEX "cart_items_cartId_variantId_key" ON "cart_items"("cartId", "variantId");
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");
CREATE INDEX "orders_userId_idx" ON "orders"("userId");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");
CREATE UNIQUE INDEX "fulfillments_orderId_key" ON "fulfillments"("orderId");
CREATE UNIQUE INDEX "easter_eggs_code_key" ON "easter_eggs"("code");
CREATE UNIQUE INDEX "easter_egg_discoveries_easterEggId_userId_key" ON "easter_egg_discoveries"("easterEggId", "userId");
CREATE UNIQUE INDEX "easter_egg_discoveries_easterEggId_sessionId_key" ON "easter_egg_discoveries"("easterEggId", "sessionId");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "easter_eggs" ADD CONSTRAINT "easter_eggs_rewardCouponId_fkey" FOREIGN KEY ("rewardCouponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "easter_egg_discoveries" ADD CONSTRAINT "easter_egg_discoveries_easterEggId_fkey" FOREIGN KEY ("easterEggId") REFERENCES "easter_eggs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "easter_egg_discoveries" ADD CONSTRAINT "easter_egg_discoveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
