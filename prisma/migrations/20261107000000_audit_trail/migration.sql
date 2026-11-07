-- Trilha de auditoria completa: eventos de negocio e seguranca, alem das rotas de admin
CREATE TYPE "AuditCategory" AS ENUM ('AUTH', 'ACCOUNT', 'PRIVACY', 'ORDER', 'PAYMENT', 'FULFILLMENT', 'RETURN', 'INVOICE', 'CONTACT', 'ADMIN', 'SYSTEM');
CREATE TYPE "AuditActorType" AS ENUM ('CUSTOMER', 'ADMIN', 'ANONYMOUS', 'SYSTEM', 'PROVIDER');
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- Linhas existentes sao todas de rotas de admin
ALTER TABLE "audit_logs"
  ADD COLUMN "category" "AuditCategory" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "actorType" "AuditActorType" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "targetType" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "requestId" TEXT,
  ALTER COLUMN "method" DROP NOT NULL,
  ALTER COLUMN "path" DROP NOT NULL,
  ALTER COLUMN "statusCode" DROP NOT NULL;

UPDATE "audit_logs" SET "outcome" = 'FAILURE' WHERE "statusCode" >= 400;

ALTER TABLE "audit_logs"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "actorType" DROP DEFAULT;

CREATE INDEX "audit_logs_category_createdAt_idx" ON "audit_logs"("category", "createdAt");
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- Imutabilidade: registro de auditoria nao pode ser alterado depois de gravado
-- (a limpeza por prazo de retencao usa DELETE, que continua permitido).
CREATE OR REPLACE FUNCTION "audit_logs_block_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs e somente insercao: registros nao podem ser alterados';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_block_update"();
