-- Fim da integracao com a Printful: producao, embalagem e postagem passam a ser da propria loja.

-- 1) Status do fulfillment: sai SENT/ERROR (estados do parceiro), entra PACKED.
--    Pedido que ja estava no parceiro (SENT) ou com falha de envio (ERROR) volta para a fila.
ALTER TYPE "FulfillmentStatus" RENAME TO "FulfillmentStatus_old";
CREATE TYPE "FulfillmentStatus" AS ENUM ('QUEUED', 'IN_PRODUCTION', 'PACKED', 'SHIPPED', 'DELIVERED');
ALTER TABLE "fulfillments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "fulfillments" ALTER COLUMN "status" TYPE "FulfillmentStatus" USING (
  CASE "status"::text
    WHEN 'SENT' THEN 'QUEUED'
    WHEN 'ERROR' THEN 'QUEUED'
    ELSE "status"::text
  END
)::"FulfillmentStatus";
ALTER TABLE "fulfillments" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
DROP TYPE "FulfillmentStatus_old";

-- 2) Dados do parceiro saem; entram os dados de embalagem e postagem.
ALTER TABLE "fulfillments"
  DROP COLUMN "provider",
  DROP COLUMN "providerOrderId",
  DROP COLUMN "lastError",
  DROP COLUMN "rawPayload",
  ADD COLUMN "carrier" TEXT NOT NULL DEFAULT 'Correios',
  ADD COLUMN "serviceCode" TEXT,
  ADD COLUMN "packageWeightGrams" INTEGER,
  ADD COLUMN "packageLengthCm" INTEGER,
  ADD COLUMN "packageWidthCm" INTEGER,
  ADD COLUMN "packageHeightCm" INTEGER,
  ADD COLUMN "internalNotes" TEXT,
  ADD COLUMN "labelPrintedAt" TIMESTAMP(3),
  ADD COLUMN "productionStartedAt" TIMESTAMP(3),
  ADD COLUMN "packedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "fulfillments" RENAME COLUMN "sentAt" TO "shippedAt";
-- sentAt era "enviado ao parceiro", nao postagem
UPDATE "fulfillments" SET "shippedAt" = NULL WHERE "status" <> 'SHIPPED' AND "status" <> 'DELIVERED';

CREATE INDEX "fulfillments_status_idx" ON "fulfillments"("status");

-- Pedido pago sem fulfillment (ex.: envio ao parceiro nunca aconteceu) entra na fila
INSERT INTO "fulfillments" ("id", "orderId", "status", "serviceCode", "updatedAt")
SELECT gen_random_uuid()::text, o."id", 'QUEUED',
       CASE o."shippingMethod" WHEN 'expresso' THEN 'SEDEX' ELSE 'PAC' END,
       CURRENT_TIMESTAMP
FROM "orders" o
LEFT JOIN "fulfillments" f ON f."orderId" = o."id"
WHERE f."id" IS NULL AND o."status" IN ('PAID', 'IN_PRODUCTION');

UPDATE "fulfillments" f SET "serviceCode" = CASE o."shippingMethod" WHEN 'expresso' THEN 'SEDEX' ELSE 'PAC' END
FROM "orders" o WHERE o."id" = f."orderId" AND f."serviceCode" IS NULL;

-- 3) Catalogo: ids de produto/variante da Printful
ALTER TABLE "products" DROP COLUMN "printProviderSku";
ALTER TABLE "product_variants" DROP COLUMN "printProviderVariantId";
