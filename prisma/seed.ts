/* eslint-disable no-console */
import { PrismaClient, Humor, CouponType, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/800`;

type VariantSeed = {
  sku: string;
  size?: string;
  color?: string;
  model?: string;
  priceCents: number;
  weightGrams: number;
  /** external_id da sync variant na Printful; sem ele o pedido nao vai para a Printful */
  printProviderVariantId?: string;
};

type ProductSeed = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  humor: Humor;
  basePriceCents: number;
  category: string;
  tags: string[];
  isFeatured?: boolean;
  isSecret?: boolean;
  rating: number;
  ratingCount: number;
  images: string[];
  variants: VariantSeed[];
};

const SHIRT_COLORS = ["Preta", "Branca", "Cinza Mescla"];
const SHIRT_SIZES = ["P", "M", "G", "GG", "XGG"];
const PHONE_MODELS = [
  "iPhone 15 Pro",
  "iPhone 14",
  "Galaxy S24",
  "Galaxy A55",
  "Moto G84",
];

function shirtVariants(prefix: string, priceCents: number): VariantSeed[] {
  const out: VariantSeed[] = [];
  SHIRT_COLORS.forEach((color) => {
    SHIRT_SIZES.forEach((size) => {
      out.push({
        sku: `${prefix}-${color.slice(0, 2).toUpperCase()}-${size}`,
        size,
        color,
        priceCents: size === "XGG" ? priceCents + 1000 : priceCents,
        weightGrams: 250,
      });
    });
  });
  return out;
}

/**
 * Sync variants reais da loja "Roupa de Domingo" na Printful (store 19007611,
 * sync product 488823609). Base: Men's Fitted Straight Cut T-Shirt (Dimona, produzida no BR).
 * Ver docs/PRINTFUL-API.md.
 */
const PRINTFUL_SHIRT_VARIANTS: Record<string, string> = {
  P: "6aea4518912a04",
  M: "6aea4518912a22",
  G: "6aea4518912a33",
  GG: "6aea4518912a58",
  XGG: "6aea4518912a67",
};

function printfulShirtVariants(prefix: string, priceCents: number): VariantSeed[] {
  return SHIRT_SIZES.map((size) => ({
    sku: `${prefix}-BR-${size}`,
    size,
    color: "Branca",
    priceCents,
    weightGrams: 250,
    printProviderVariantId: PRINTFUL_SHIRT_VARIANTS[size],
  }));
}

function mugVariants(prefix: string, priceCents: number): VariantSeed[] {
  return [
    { sku: `${prefix}-325`, size: "325ml", priceCents, weightGrams: 600 },
    {
      sku: `${prefix}-475`,
      size: "475ml",
      priceCents: priceCents + 1500,
      weightGrams: 780,
    },
  ];
}

function caseVariants(prefix: string, priceCents: number): VariantSeed[] {
  return PHONE_MODELS.map((model) => ({
    sku: `${prefix}-${model
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 10)}`,
    model,
    priceCents,
    weightGrams: 120,
  }));
}

const CATEGORIES = [
  {
    slug: "camisetas",
    name: "Camisetas",
    emoji: "👕",
    description: "Algodão honesto para frases desonestas.",
    position: 1,
  },
  {
    slug: "canecas",
    name: "Canecas",
    emoji: "☕",
    description: "Porque café sem ironia é só água quente amarga.",
    position: 2,
  },
  {
    slug: "capas-de-celular",
    name: "Capas de Celular",
    emoji: "📱",
    description: "Protege o aparelho. Não protege suas decisões.",
    position: 3,
  },
  {
    slug: "secretos",
    name: "Achados Secretos",
    emoji: "🕳️",
    description: "Só aparece pra quem procura onde não devia.",
    position: 4,
  },
];

const PRODUCTS: ProductSeed[] = [
  {
    slug: "camiseta-sorria-e-de-graca",
    name: "Sorria, é de graça (o resto não)",
    shortDescription: "A gentileza é gratuita. A camiseta, infelizmente, não.",
    description:
      "Camiseta de algodão penteado 30.1 com estampa em serigrafia digital. Ideal para quem quer parecer simpático sem se comprometer. Lavar do lado avesso, como suas intenções.",
    humor: Humor.ACIDO,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "sarcasmo", "presente", "best-seller"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 312,
    images: [img("rd-sorria-1"), img("rd-sorria-2")],
    variants: shirtVariants("CAM-SORRIA", 8990),
  },
  {
    slug: "camiseta-estou-bem-mentira",
    name: "Estou bem (mentira estampada)",
    shortDescription: "Duas palavras, uma vida inteira de negação.",
    description:
      'Para aquele dia em que você responde "tudo ótimo" três vezes antes das 9h. Modelagem reta, gola reforçada, autoestima opcional.',
    humor: Humor.EXISTENCIAL,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "existencial", "terapia", "segunda-feira"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 487,
    images: [img("rd-bem-1"), img("rd-bem-2")],
    variants: shirtVariants("CAM-BEM", 8990),
  },
  {
    slug: "camiseta-trabalho-em-equipe",
    name: "Trabalho bem em equipe (sozinho)",
    shortDescription: "Currículo honesto, finalmente.",
    description:
      "A camiseta que seu RH precisava ler antes da contratação. Tecido respirável para reuniões que poderiam ser um e-mail.",
    humor: Humor.SARCASTICO,
    basePriceCents: 9490,
    category: "camisetas",
    tags: ["camiseta", "trabalho", "corporativo", "home-office"],
    isFeatured: true,
    rating: 4.7,
    ratingCount: 221,
    images: [img("rd-equipe-1"), img("rd-equipe-2")],
    variants: shirtVariants("CAM-EQUIPE", 9490),
  },
  {
    slug: "camiseta-roupa-de-domingo",
    name: "Roupa de Domingo (a original)",
    shortDescription: "O nome da loja no peito. Produzida sob demanda no Brasil.",
    description:
      "Camiseta branca 100% algodão fio penteado, impressão DTG na frente. Feita sob demanda pela nossa estamparia parceira e enviada direto para você. Primeira peça integrada à produção real.",
    humor: Humor.EXISTENCIAL,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "colecao-assinatura", "domingo", "producao-real"],
    isFeatured: true,
    rating: 5,
    ratingCount: 1,
    images: [
      "https://files.cdn.printful.com/files/e77/e771b034155f87bfd99153441f4d3c51_preview.png",
    ],
    variants: printfulShirtVariants("CAM-RD", 8990),
  },
  {
    slug: "camiseta-domingo-eterno",
    name: "Domingo é uma sensação, não um dia",
    shortDescription: "A ansiedade das 18h de domingo, agora vestível.",
    description:
      "Nossa peça manifesto. Homenageia aquele vazio específico entre o almoço de família e a segunda-feira. Algodão macio, melancolia inclusa.",
    humor: Humor.EXISTENCIAL,
    basePriceCents: 9990,
    category: "camisetas",
    tags: ["camiseta", "manifesto", "domingo", "colecao-assinatura"],
    isFeatured: true,
    rating: 5,
    ratingCount: 158,
    images: [img("rd-domingo-1"), img("rd-domingo-2"), img("rd-domingo-3")],
    variants: shirtVariants("CAM-DOMINGO", 9990),
  },
  {
    slug: "camiseta-nao-foi-nada",
    name: '"Não foi nada" (era tudo)',
    shortDescription: "Passivo-agressivo em 4 palavras e um parêntese.",
    description:
      "Para quem resolve conflito guardando mágoa com juros compostos. Estampa resistente a 50 lavagens e a pedidos de desculpas.",
    humor: Humor.PASSIVO_AGRESSIVO,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "passivo-agressivo", "relacionamento"],
    rating: 4.6,
    ratingCount: 94,
    images: [img("rd-nadafoi-1")],
    variants: shirtVariants("CAM-NADA", 8990),
  },
  {
    slug: "caneca-primeiro-cafe",
    name: "Antes do café eu não assino contrato",
    shortDescription: "Aviso legal em cerâmica.",
    description:
      "Caneca de cerâmica branca com impressão sublimática. Suporta micro-ondas, lava-louças e sua personalidade matinal.",
    humor: Humor.ACIDO,
    basePriceCents: 6490,
    category: "canecas",
    tags: ["caneca", "cafe", "escritorio", "best-seller"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 603,
    images: [img("rd-cafe-1"), img("rd-cafe-2")],
    variants: mugVariants("CAN-CAFE", 6490),
  },
  {
    slug: "caneca-reuniao-email",
    name: "Isso podia ser um e-mail",
    shortDescription: "Diga sem dizer, em toda call com câmera aberta.",
    description:
      "A caneca mais produtiva do mercado: economiza em média 4 reuniões por semana. Resultado não garantido, mas a intenção é clara.",
    humor: Humor.SARCASTICO,
    basePriceCents: 6490,
    category: "canecas",
    tags: ["caneca", "trabalho", "reuniao", "home-office"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 441,
    images: [img("rd-email-1")],
    variants: mugVariants("CAN-EMAIL", 6490),
  },
  {
    slug: "caneca-chefe-do-ano",
    name: "Chefe do ano (votação com 1 voto)",
    shortDescription: "O presente de amigo oculto que cria histórico.",
    description:
      "Perfeita para aquele gestor que confunde liderança com reunião às 18h de sexta. Vem em embalagem neutra para negação plausível.",
    humor: Humor.PASSIVO_AGRESSIVO,
    basePriceCents: 6990,
    category: "canecas",
    tags: ["caneca", "presente", "amigo-oculto", "trabalho"],
    rating: 4.5,
    ratingCount: 177,
    images: [img("rd-chefe-1")],
    variants: mugVariants("CAN-CHEFE", 6990),
  },
  {
    slug: "caneca-lagrimas-dos-meus-inimigos",
    name: "Lágrimas dos meus inimigos (sem açúcar)",
    shortDescription: "Capacidade: 475ml de rancor bem gelado.",
    description:
      "Clássico do gênero, revisado. Mantém a bebida na temperatura exata do seu ressentimento por cerca de 20 minutos.",
    humor: Humor.ABSURDO,
    basePriceCents: 6490,
    category: "canecas",
    tags: ["caneca", "absurdo", "classico"],
    rating: 4.7,
    ratingCount: 265,
    images: [img("rd-lagrimas-1")],
    variants: mugVariants("CAN-LAGRIMAS", 6490),
  },
  {
    slug: "capa-visto-e-nao-respondido",
    name: "Visto e não respondido",
    shortDescription: "Sua política de comunicação, agora em policarbonato.",
    description:
      "Capa rígida com borda emborrachada e impressão UV. Protege contra quedas de até 1,5m e contra expectativas alheias.",
    humor: Humor.PASSIVO_AGRESSIVO,
    basePriceCents: 7990,
    category: "capas-de-celular",
    tags: ["capa", "celular", "passivo-agressivo", "best-seller"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 389,
    images: [img("rd-visto-1"), img("rd-visto-2")],
    variants: caseVariants("CAP-VISTO", 7990),
  },
  {
    slug: "capa-bateria-social-2",
    name: "Bateria social: 2%",
    shortDescription: "Ninguém precisa perguntar se você quer sair.",
    description:
      'Capa com acabamento fosco antidigital. Comunica seu limite social antes de qualquer convite para "um rolê rápido".',
    humor: Humor.EXISTENCIAL,
    basePriceCents: 7990,
    category: "capas-de-celular",
    tags: ["capa", "celular", "introvertido", "existencial"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 512,
    images: [img("rd-bateria-1")],
    variants: caseVariants("CAP-BATERIA", 7990),
  },
  {
    slug: "capa-rolando-por-nada",
    name: "Rolando a tela por nada específico",
    shortDescription: "Autoconsciência não cura, mas estampa bem.",
    description:
      "Capa flexível TPU com impressão em alta definição. Acompanha a honestidade que seu tempo de tela merece.",
    humor: Humor.ACIDO,
    basePriceCents: 7490,
    category: "capas-de-celular",
    tags: ["capa", "celular", "internet", "acido"],
    rating: 4.6,
    ratingCount: 143,
    images: [img("rd-rolando-1")],
    variants: caseVariants("CAP-ROLANDO", 7490),
  },
  {
    slug: "capa-ja-vou-sair-de-casa",
    name: '"Já estou saindo" (ainda deitado)',
    shortDescription: "A mentira mais democrática do Brasil.",
    description:
      "Capa resistente com proteção de câmera elevada. Para quem calcula o trajeto, mas não levanta.",
    humor: Humor.SARCASTICO,
    basePriceCents: 7490,
    category: "capas-de-celular",
    tags: ["capa", "celular", "atraso", "sarcasmo"],
    rating: 4.7,
    ratingCount: 208,
    images: [img("rd-saindo-1")],
    variants: caseVariants("CAP-SAINDO", 7490),
  },
  {
    slug: "camiseta-voce-nao-devia-estar-aqui",
    name: "Você não devia estar aqui",
    shortDescription: "Peça secreta. Encontrada, não comprada.",
    description:
      "Edição limitada que não aparece no catálogo normal. Se você está lendo isto, descobriu easter eggs suficientes para merecer uma camiseta que ninguém vai entender. Exatamente o ponto.",
    humor: Humor.ABSURDO,
    basePriceCents: 11990,
    category: "secretos",
    tags: ["camiseta", "secreto", "easter-egg", "edicao-limitada"],
    isSecret: true,
    rating: 5,
    ratingCount: 13,
    images: [img("rd-secreta-1"), img("rd-secreta-2")],
    variants: shirtVariants("CAM-SECRETA", 11990),
  },
];

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
    code: "CONSOLE_CURIOSO",
    title: "Curioso Profissional",
    hint: "Desenvolvedores olham onde o usuário comum não olha.",
    message:
      "Você abriu o console. Isso tecnicamente é invadir a cozinha do restaurante. Deixamos uma vaga de emprego lá dentro.",
    trigger: "devtools-console",
    points: 20,
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
    // Producao: nada de usuario com senha conhecida. Admin so se as variaveis vierem.
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      console.log(`👤 Criando admin ${adminEmail}...`);
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 10),
          name: "Admin do Domingo",
          role: Role.ADMIN,
        },
      });
    } else {
      console.log("👤 Producao sem SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD: nenhum usuario criado.");
    }
  } else {
    console.log("👤 Criando usuários demo...");
    const passwordHash = await bcrypt.hash("domingo123", 10);

    await prisma.user.create({
      data: {
        email: "cliente@roupadedomingo.com",
        passwordHash,
        name: "Maria Souza",
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

    await prisma.user.create({
      data: {
        email: "admin@roupadedomingo.com",
        passwordHash,
        name: "Admin do Domingo",
        role: Role.ADMIN,
        humorLevel: 100,
      },
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
        printProviderSku: `RD-${p.slug.toUpperCase().slice(0, 18)}`,
        images: {
          create: p.images.map((url, i) => ({
            url,
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
            printProviderVariantId: v.printProviderVariantId ?? null,
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
