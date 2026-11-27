-- Analise de origem das visitas e das vendas (QR Code, redes sociais, campanhas)
CREATE TABLE "traffic_visits" (
    "id" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "landingPath" TEXT NOT NULL,
    "referrerHost" TEXT,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "traffic_visits_createdAt_idx" ON "traffic_visits"("createdAt");
CREATE INDEX "traffic_visits_channel_createdAt_idx" ON "traffic_visits"("channel", "createdAt");
CREATE INDEX "traffic_visits_visitorHash_idx" ON "traffic_visits"("visitorHash");

ALTER TABLE "orders" ADD COLUMN "visitId" TEXT,
ADD COLUMN "attributionChannel" TEXT,
ADD COLUMN "attributionSource" TEXT,
ADD COLUMN "attributionCampaign" TEXT,
ADD COLUMN "attributionContent" TEXT;

CREATE INDEX "orders_attributionChannel_createdAt_idx" ON "orders"("attributionChannel", "createdAt");

ALTER TABLE "orders" ADD CONSTRAINT "orders_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "traffic_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
