-- Analise no estilo Google Analytics: sessoes, paginas vistas, tempo de engajamento,
-- localizacao aproximada, tecnologia e eventos de compra
ALTER TABLE "traffic_visits"
ADD COLUMN "os" TEXT,
ADD COLUMN "browser" TEXT,
ADD COLUMN "screen" TEXT,
ADD COLUMN "language" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "isNewVisitor" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "minimal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pageviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "engagedMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "traffic_visits" SET "lastSeenAt" = "createdAt";

DROP INDEX IF EXISTS "traffic_visits_visitorHash_idx";
CREATE INDEX "traffic_visits_visitorHash_lastSeenAt_idx" ON "traffic_visits"("visitorHash", "lastSeenAt");

CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "seq" INTEGER NOT NULL,
    "engagedMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "page_views_visitId_seq_idx" ON "page_views"("visitId", "seq");
CREATE INDEX "page_views_createdAt_idx" ON "page_views"("createdAt");
CREATE INDEX "page_views_path_createdAt_idx" ON "page_views"("path", "createdAt");
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "traffic_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "valueCents" INTEGER,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_events_name_createdAt_idx" ON "analytics_events"("name", "createdAt");
CREATE INDEX "analytics_events_visitId_idx" ON "analytics_events"("visitId");
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "traffic_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
