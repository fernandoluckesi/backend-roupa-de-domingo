-- Ordem dos produtos na vitrine da home (1 = primeiro). NULL vem depois dos ordenados.
ALTER TABLE "products" ADD COLUMN "featuredPosition" INTEGER;
