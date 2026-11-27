-- Checkout em etapas: itens marcados no carrinho e endereco usado por ultimo
ALTER TABLE "cart_items" ADD COLUMN "selected" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "addresses" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
