-- Codigos de 6 digitos por e-mail (cadastro, troca e redefinicao de senha)
ALTER TYPE "AuthTokenType" ADD VALUE 'PASSWORD_CHANGE';
ALTER TABLE "auth_tokens" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- O login passa a exigir e-mail confirmado. Contas criadas antes desta mudanca
-- (quando a confirmacao era opcional) ficam como confirmadas para nao travar ninguem.
UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
