/* eslint-disable no-console */
/**
 * Sincroniza categorias, produtos, variantes e imagens com prisma/catalog.ts
 * SEM apagar pedidos, carrinhos ou usuarios. Idempotente: pode rodar a cada deploy.
 *
 * - Categoria e produto: upsert pelo slug.
 * - Variante: upsert pelo SKU. Variantes que sairam do catalogo ficam isAvailable=false
 *   (nao sao apagadas porque pedidos antigos referenciam elas).
 * - Imagens: substituidas pelas do catalogo.
 *
 * Uso: npm run catalog:sync
 */
import { PrismaClient } from "@prisma/client";
import { CATEGORIES, PRODUCTS } from "./catalog";

const prisma = new PrismaClient();

async function main() {
  const categoryIds = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: {
        name: cat.name,
        emoji: cat.emoji,
        description: cat.description,
        position: cat.position,
      },
    });
    categoryIds.set(cat.slug, saved.id);
  }

  let variantsUpserted = 0;
  let variantsDisabled = 0;

  for (const p of PRODUCTS) {
    const data = {
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      humor: p.humor,
      basePriceCents: p.basePriceCents,
      categoryId: categoryIds.get(p.category)!,
      tags: p.tags,
      isFeatured: p.isFeatured ?? false,
      isSecret: p.isSecret ?? false,
    };

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        ...data,
        rating: p.rating,
        ratingCount: p.ratingCount,
        printProviderSku: `RD-${p.slug.toUpperCase().slice(0, 18)}`,
      },
      update: data,
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.images.map((url, i) => ({
        productId: product.id,
        url,
        alt: `${p.name} - imagem ${i + 1}`,
        position: i,
      })),
    });

    const skus = p.variants.map((v) => v.sku);
    for (const v of p.variants) {
      const variantData = {
        size: v.size ?? null,
        color: v.color ?? null,
        model: v.model ?? null,
        priceCents: v.priceCents,
        weightGrams: v.weightGrams,
        printProviderVariantId: v.printProviderVariantId ?? null,
        isAvailable: true,
      };
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        create: { sku: v.sku, productId: product.id, ...variantData },
        update: { productId: product.id, ...variantData },
      });
      variantsUpserted++;
    }

    const disabled = await prisma.productVariant.updateMany({
      where: { productId: product.id, sku: { notIn: skus }, isAvailable: true },
      data: { isAvailable: false },
    });
    variantsDisabled += disabled.count;
  }

  // Itens de carrinho apontando para variantes desativadas sairiam do carrinho no checkout com erro:
  // remove-os agora para o cliente nao ser surpreendido.
  const staleCartItems = await prisma.cartItem.deleteMany({
    where: { variant: { isAvailable: false } },
  });

  console.log("🔄 Catalogo sincronizado:", {
    categorias: CATEGORIES.length,
    produtos: PRODUCTS.length,
    variantes: variantsUpserted,
    variantesDesativadas: variantsDisabled,
    itensDeCarrinhoRemovidos: staleCartItems.count,
  });
}

main()
  .catch((e) => {
    console.error("❌ catalog:sync falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
