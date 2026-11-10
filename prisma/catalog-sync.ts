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
import { CATEGORIES, PRODUCTS, imageFields } from "./catalog";

const prisma = new PrismaClient();

/**
 * Easter eggs criados depois da carga inicial do banco. Mantidos aqui (e nao
 * importados de seed.ts, que executa main() no import) para que um deploy em
 * banco existente receba o registro via `npm run catalog:sync`.
 */
const NEW_EASTER_EGGS = [
  {
    code: "QR_CODE_SEGREDO",
    title: "Leitor de Etiqueta",
    hint: "Aponte a câmera para o QR Code impresso na embalagem.",
    message:
      "Você escaneou um QR Code esperando um segredo e recebeu uma loja de camiseta. A curiosidade foi recompensada com um troféu e nenhuma revelação.",
    // Sem cupom de recompensa: o premio e o trofeu e a decepcao.
    trigger: "scan-qr-code",
    points: 15,
    // Desativado: a tela /segredo nao dispara mais o discover(), porque a
    // notificacao de troféu estragava a piada. Inativo nao entra no total,
    // entao o rank "Lenda do Domingo" continua alcancavel.
    isActive: false,
  },
];

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
      gender: p.gender,
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
      },
      update: data,
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.images.map((image, i) => ({
        productId: product.id,
        ...imageFields(image),
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

  // Produto que saiu de prisma/catalog.ts (ex.: capas de celular) e desativado em
  // vez de apagado: order_items referencia as variantes de pedidos antigos.
  const catalogSlugs = PRODUCTS.map((p) => p.slug);
  const retiredProducts = await prisma.product.updateMany({
    where: { slug: { notIn: catalogSlugs }, isActive: true },
    data: { isActive: false },
  });
  await prisma.productVariant.updateMany({
    where: { product: { slug: { notIn: catalogSlugs } }, isAvailable: true },
    data: { isAvailable: false },
  });

  // Easter eggs aposentados: somem da contagem sem apagar descobertas antigas
  const retiredEggs = await prisma.easterEgg.updateMany({
    where: { code: { in: ["CONSOLE_CURIOSO"] }, isActive: true },
    data: { isActive: false },
  });

  // Easter eggs adicionados depois da carga inicial. O seed so roda em banco
  // vazio, entao sem este upsert o discover() falharia em producao.
  // Nao importamos a lista de seed.ts de proposito: aquele arquivo executa
  // main() no import e apagaria os dados.
  let eggsUpserted = 0;
  for (const egg of NEW_EASTER_EGGS) {
    const { isActive, ...fields } = egg;
    await prisma.easterEgg.upsert({
      where: { code: egg.code },
      create: { ...fields, isActive },
      update: { ...fields, isActive },
    });
    eggsUpserted++;
  }

  // Itens de carrinho apontando para variantes desativadas sairiam do carrinho no checkout com erro:
  // remove-os agora para o cliente nao ser surpreendido.
  const staleCartItems = await prisma.cartItem.deleteMany({
    where: { variant: { isAvailable: false } },
  });

  console.log("🔄 Catalogo sincronizado:", {
    categorias: CATEGORIES.length,
    produtos: PRODUCTS.length,
    produtosDescontinuados: retiredProducts.count,
    variantes: variantsUpserted,
    variantesDesativadas: variantsDisabled,
    easterEggsGarantidos: eggsUpserted,
    itensDeCarrinhoRemovidos: staleCartItems.count,
    easterEggsAposentados: retiredEggs.count,
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
