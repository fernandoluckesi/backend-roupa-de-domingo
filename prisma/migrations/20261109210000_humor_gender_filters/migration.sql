-- Filtros do catalogo: novos tipos de humor, filtro de genero e saida das capas de celular.
--
-- 1. Humor: entram PARA_CASAIS e POLITICO; saem PASSIVO_AGRESSIVO e ABSURDO.
--    O Postgres nao remove valor de enum, entao o tipo e recriado. A ordem importa:
--    primeiro as linhas sao remapeadas para valores que existem nos DOIS tipos,
--    depois a coluna e convertida, e so entao os valores novos podem ser usados.
-- 2. Gender: novo enum e coluna em products, default UNISSEX.
-- 3. Capas de celular: produtos desativados e categoria fora do catalogo.
--    Produtos nao sao apagados porque order_items referencia as variantes.

-- ---------------------------------------------------------------- 1. Humor

-- Remapeia para valores presentes no enum antigo e no novo, senao o cast falha.
UPDATE "products" SET "humor" = 'SARCASTICO' WHERE "humor" = 'PASSIVO_AGRESSIVO';
UPDATE "products" SET "humor" = 'ACIDO'      WHERE "humor" = 'ABSURDO';

CREATE TYPE "Humor_new" AS ENUM (
  'ACIDO',
  'SARCASTICO',
  'EXISTENCIAL',
  'MEMES',
  'PARA_CASAIS',
  'POLITICO'
);

ALTER TABLE "products" ALTER COLUMN "humor" DROP DEFAULT;

ALTER TABLE "products"
  ALTER COLUMN "humor" TYPE "Humor_new"
  USING ("humor"::text::"Humor_new");

DROP TYPE "Humor";
ALTER TYPE "Humor_new" RENAME TO "Humor";

ALTER TABLE "products" ALTER COLUMN "humor" SET DEFAULT 'ACIDO';

-- Agora o enum ja aceita os valores novos. Reclassificacao individual: o destino
-- segue o tom da frase de cada peca, nao uma regra automatica.
UPDATE "products" SET "humor" = 'PARA_CASAIS'
 WHERE "slug" = 'camiseta-nao-foi-nada';

UPDATE "products" SET "humor" = 'EXISTENCIAL'
 WHERE "slug" = 'garrafa-hidratado-e-cansado';

-- ---------------------------------------------------------------- 2. Gender

CREATE TYPE "Gender" AS ENUM ('UNISSEX', 'MASCULINO', 'FEMININO');

ALTER TABLE "products"
  ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNISSEX';

CREATE INDEX "products_gender_idx" ON "products"("gender");

-- Peca com modelagem de corte especifico. O resto continua UNISSEX e aparece
-- em qualquer selecao de genero.
UPDATE "products" SET "gender" = 'MASCULINO'
 WHERE "slug" IN ('camiseta-trabalho-em-equipe', 'camiseta-sextou-e-terca');

UPDATE "products" SET "gender" = 'FEMININO'
 WHERE "slug" IN ('moletom-socialmente-indisponivel', 'camiseta-estou-bem-mentira');

-- ------------------------------------------------- 3. Saida das capas de celular

-- Tira do carrinho antes de desativar, para ninguem levar o item ao checkout.
DELETE FROM "cart_items"
 WHERE "variantId" IN (
   SELECT v."id"
     FROM "product_variants" v
     JOIN "products" p ON p."id" = v."productId"
     JOIN "categories" c ON c."id" = p."categoryId"
    WHERE c."slug" = 'capas-de-celular'
 );

UPDATE "product_variants" SET "isAvailable" = false
 WHERE "productId" IN (
   SELECT p."id"
     FROM "products" p
     JOIN "categories" c ON c."id" = p."categoryId"
    WHERE c."slug" = 'capas-de-celular'
 );

UPDATE "products" SET "isActive" = false
 WHERE "categoryId" IN (
   SELECT "id" FROM "categories" WHERE "slug" = 'capas-de-celular'
 );

-- A categoria nao e apagada: produtos desativados ainda apontam para ela (FK).
-- Ela sai do site porque listCategories passa a filtrar categoria sem produto ativo.
UPDATE "categories"
   SET "position" = 99,
       "description" = 'Categoria descontinuada.'
 WHERE "slug" = 'capas-de-celular';
