-- Troca de e-mail confirmada por codigo enviado ao endereco novo
ALTER TYPE "AuthTokenType" ADD VALUE 'EMAIL_CHANGE';
ALTER TABLE "auth_tokens" ADD COLUMN "newEmail" TEXT;
