/* eslint-disable no-console */
import { PrismaClient, CouponType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { CATEGORIES, PRODUCTS, imageFields } from "./catalog";

const prisma = new PrismaClient();

// Categorias e produtos vivem em catalog.ts (compartilhado com o catalog:sync de producao)

const COUPONS = [
  {
    code: "DOMINGO10",
    description: "Dez por cento de alívio para um domingo qualquer.",
    type: CouponType.PERCENT,
    value: 10,
    minSubtotalCents: 0,
    isSecret: false,
  },
  {
    code: "FRETEGRATIS",
    description: "Frete grátis. O carteiro não trabalha de graça, nós pagamos.",
    type: CouponType.FREE_SHIPPING,
    value: 0,
    minSubtotalCents: 14900,
    isSecret: false,
  },
  {
    code: "CAOS30",
    description: "Recompensa por digitar um código de videogame de 1986.",
    type: CouponType.PERCENT,
    value: 30,
    minSubtotalCents: 9900,
    isSecret: true,
    maxUses: 500,
  },
  {
    code: "DESCULPA15",
    description:
      "Desconto de arrependimento. Aceitamos o seu pedido de desculpas.",
    type: CouponType.PERCENT,
    value: 15,
    minSubtotalCents: 0,
    isSecret: true,
    maxUses: 500,
  },
  {
    code: "QUARENTADOIS",
    description: "Frete grátis para quem entendeu a resposta para tudo.",
    type: CouponType.FREE_SHIPPING,
    value: 0,
    minSubtotalCents: 0,
    isSecret: true,
    maxUses: 420,
  },
];

const EASTER_EGGS = [
  {
    code: "KONAMI_CAOS",
    title: "Modo Caos",
    hint: "Gamers de 1986 sabem o caminho. Cima, cima, baixo, baixo...",
    message:
      "Você digitou um código de videogame de 1986 para ganhar desconto numa loja de camiseta em 2026. Respeito genuíno. Toma 30%.",
    trigger: "konami-code",
    points: 30,
    rewardCode: "CAOS30",
  },
  {
    code: "LOGO_SETE_CLIQUES",
    title: "Domingo de Manhã",
    hint: "Insista no logo. Sete vezes. Ele não vai reagir na primeira.",
    message:
      "Sete cliques no mesmo logo. Ele não vai mudar de ideia sobre você, mas o site vai ficar com cara de domingo 9h da manhã.",
    trigger: "logo-click-streak",
    points: 10,
    rewardCode: null,
  },
  {
    code: "PEDIDO_DE_DESCULPAS",
    title: "Desculpa Aceita",
    hint: "Digite uma palavra que você diz demais, mesmo sem motivo.",
    message:
      "Aceitamos o pedido de desculpas que você provavelmente nem devia ter feito. Toma 15% e pare de se desculpar por existir.",
    trigger: "typed-phrase:desculpa",
    points: 15,
    rewardCode: "DESCULPA15",
  },
  {
    code: "CARRINHO_VAZIO_TRES_VEZES",
    title: "Terapia de Carrinho",
    hint: "Olhar o vazio uma vez é acidente. Três vezes é rotina.",
    message:
      "Terceira vez abrindo um carrinho vazio. Isso não é compra, é terapia. E a nossa custa menos que a sessão.",
    trigger: "empty-cart-x3",
    points: 10,
    rewardCode: null,
  },

  {
    code: "RODAPE_CONFISSAO",
    title: "Confissão do Rodapé",
    hint: "Ninguém lê rodapé. Fique parado nele por cinco segundos.",
    message:
      "Ninguém lê rodapé, então aqui vai a verdade: a gente também não sabe exatamente o que está fazendo. Bem-vindo ao clube.",
    trigger: "footer-long-hover",
    points: 15,
    rewardCode: null,
  },
  {
    code: "QUARENTA_E_DOIS",
    title: "A Resposta Para Tudo",
    hint: "Existe um número que responde tudo. Coloque ele na quantidade.",
    message:
      '42 unidades do mesmo item. A resposta para tudo, inclusive para "quantas camisetas iguais são demais". Frete grátis, corajoso.',
    trigger: "quantity-42",
    points: 25,
    rewardCode: "QUARENTADOIS",
  },
  {
    code: "QUATRO_ZERO_QUATRO",
    title: "Perdido de Propósito",
    hint: "Digite um endereço que não existe. Erre de propósito.",
    message:
      "Esta página não existe. Igual aos seus planos para domingo à noite. Pelo menos aqui você ganhou um troféu.",
    trigger: "route-404",
    points: 10,
    rewardCode: null,
  },
  {
    code: "PRODUTO_SECRETO",
    title: "Chave do Porão",
    hint: "Encontre quatro segredos e a loja abre uma gaveta escondida.",
    message:
      "Quatro segredos encontrados. Liberamos a peça que não aparece no catálogo. Ela não faz sentido para ninguém além de você.",
    trigger: "discover-4-eggs",
    points: 50,
    rewardCode: null,
  },
];

const IS_PRODUCTION = process.env.NODE_ENV === "production";

async function main() {
  // SEED_IF_EMPTY=true: carga inicial no deploy. So roda com o banco vazio, nunca apaga dados.
  const firstLoad = process.env.SEED_IF_EMPTY === "true";
  if (firstLoad) {
    const [products, orders, users] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count(),
    ]);
    if (products + orders + users > 0) {
      console.log("🌱 Banco ja possui dados: seed ignorado.");
      return;
    }
    console.log("🌱 Banco vazio: carga inicial do catalogo.");
  }

  // O seed apaga TODAS as tabelas. Em producao so roda com permissao explicita.
  if (IS_PRODUCTION && !firstLoad && process.env.SEED_ALLOW_RESET !== "true") {
    throw new Error(
      "Seed em producao apaga todos os dados. Defina SEED_ALLOW_RESET=true para confirmar.",
    );
  }

  console.log("🧹 Limpando dados anteriores...");
  await prisma.easterEggDiscovery.deleteMany();
  await prisma.easterEgg.deleteMany();
  await prisma.fulfillment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  if (IS_PRODUCTION) {
    // Producao: nada de usuario com senha conhecida. A equipe do backoffice vem do seed:admin
    // (tabela admin_users, variaveis ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD).
    console.log("👤 Producao: nenhum usuario demo criado.");
  } else {
    console.log("👤 Criando usuários demo...");
    const passwordHash = await bcrypt.hash("domingo123", 10);

    await prisma.user.create({
      data: {
        email: "cliente@roupadedomingo.com",
        passwordHash,
        name: "Maria Souza",
        emailVerifiedAt: new Date(),
        phone: "11988887777",
        document: "12345678909",
        humorLevel: 87,
        addresses: {
          create: {
            label: "Casa",
            recipient: "Maria Souza",
            zipCode: "01310100",
            street: "Avenida Paulista",
            number: "1000",
            complement: "Apto 142",
            district: "Bela Vista",
            city: "São Paulo",
            state: "SP",
            isDefault: true,
          },
        },
      },
    });

    // Admin do backoffice (tabela propria, separada dos clientes) so em desenvolvimento
    await prisma.adminUser.deleteMany();
    await prisma.adminUser.create({
      data: { email: "admin@roupadedomingo.com", passwordHash, name: "Admin do Domingo" },
    });
  }

  console.log("🏷️  Criando categorias...");
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({ data: cat });
    categoryMap.set(cat.slug, created.id);
  }

  console.log("🎟️  Criando cupons...");
  const couponMap = new Map<string, string>();
  for (const coupon of COUPONS) {
    const created = await prisma.coupon.create({ data: coupon });
    couponMap.set(coupon.code, created.id);
  }

  console.log("👕 Criando produtos...");
  for (const p of PRODUCTS) {
    await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        humor: p.humor,
        basePriceCents: p.basePriceCents,
        categoryId: categoryMap.get(p.category)!,
        tags: p.tags,
        isFeatured: p.isFeatured ?? false,
        isSecret: p.isSecret ?? false,
        rating: p.rating,
        ratingCount: p.ratingCount,
        images: {
          create: p.images.map((image, i) => ({
            ...imageFields(image),
            alt: `${p.name} - imagem ${i + 1}`,
            position: i,
          })),
        },
        variants: {
          create: p.variants.map((v) => ({
            sku: v.sku,
            size: v.size ?? null,
            color: v.color ?? null,
            model: v.model ?? null,
            priceCents: v.priceCents,
            weightGrams: v.weightGrams,
          })),
        },
      },
    });
  }

  console.log("🥚 Criando easter eggs...");
  for (const egg of EASTER_EGGS) {
    const { rewardCode, ...rest } = egg;
    await prisma.easterEgg.create({
      data: {
        ...rest,
        rewardCouponId: rewardCode ? (couponMap.get(rewardCode) ?? null) : null,
      },
    });
  }

  const totals = {
    categorias: await prisma.category.count(),
    produtos: await prisma.product.count(),
    variantes: await prisma.productVariant.count(),
    cupons: await prisma.coupon.count(),
    easterEggs: await prisma.easterEgg.count(),
  };

  console.log("\n✅ Seed concluído:", totals);
  if (!IS_PRODUCTION) {
    console.log("   Login demo: cliente@roupadedomingo.com / domingo123");
    console.log("   Admin:      admin@roupadedomingo.com / domingo123\n");
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
