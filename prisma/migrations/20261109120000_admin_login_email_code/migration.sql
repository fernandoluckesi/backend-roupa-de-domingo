-- Login de admin: segunda etapa por codigo enviado ao e-mail; sai o 2FA por app autenticador (TOTP).
ALTER TYPE "AuthTokenType" ADD VALUE IF NOT EXISTS 'LOGIN_CODE';

-- Segredos TOTP deixam de existir (minimizacao, LGPD art. 6o, III)
ALTER TABLE "users" DROP COLUMN IF EXISTS "twoFactorSecret";
ALTER TABLE "users" DROP COLUMN IF EXISTS "twoFactorEnabled";
