/**
 * Catalogo da loja: fonte unica para o seed (banco vazio) e para o catalog:sync (producao).
 * Todos os produtos existem na Printful (store 19007611); o SKU de cada variante e o
 * external_id da sync variant, por isso printProviderVariantId = sku.
 * Imagens: mockups reais da Printful servidos pelo frontend em /products.
 * Ver docs/PRINTFUL-API.md.
 */
import { Humor } from "@prisma/client";

export type VariantSeed = {
  sku: string;
  size?: string;
  color?: string;
  model?: string;
  priceCents: number;
  weightGrams: number;
  /** external_id da sync variant na Printful; sem ele o pedido nao vai para a Printful */
  printProviderVariantId?: string;
};

export type CatalogImage = string | { url: string; color?: string };

/** Campos de ProductImage a partir de uma imagem do catalogo. */
export function imageFields(image: CatalogImage): { url: string; color: string | null } {
  return typeof image === "string"
    ? { url: image, color: null }
    : { url: image.url, color: image.color ?? null };
}

export type ProductSeed = {
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
  /** URL ou { url, color }: com cor, a pagina do produto troca para essa foto ao escolher a cor */
  images: CatalogImage[];
  variants: VariantSeed[];
};

const SHIRT_SIZES = ["P", "M", "G", "GG", "XGG"];

/**
 * Camiseta original: sync product 488823609, criada no editor da Printful (so branca).
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

export const CATEGORIES = [
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
    slug: "moletons",
    name: "Moletons",
    emoji: "🧥",
    description: "Para o frio e para esconder o rosto depois do que você postou.",
    position: 4,
  },
  {
    slug: "garrafas",
    name: "Garrafas",
    emoji: "🧴",
    description: "Hidratação com opinião. Mantém a água gelada e o sarcasmo também.",
    position: 5,
  },
  {
    slug: "secretos",
    name: "Achados Secretos",
    emoji: "🕳️",
    description: "Só aparece pra quem procura onde não devia.",
    position: 6,
  },
];

export const PRODUCTS: ProductSeed[] = [
  {
    slug: "camiseta-sorria-e-de-graca",
    name: "Sorria, é de graça (o resto não)",
    shortDescription: "A gentileza é gratuita. A camiseta, infelizmente, não.",
    description:
      "Camiseta 100% algodão fio penteado, produzida no Brasil, com estampa DTG na frente. Ideal para quem quer parecer simpático sem se comprometer. Lavar do lado avesso, como suas intenções.",
    humor: Humor.ACIDO,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "sarcasmo", "presente", "best-seller"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 312,
    images: [
      { url: "/products/camiseta-sorria-e-de-graca-1.jpg", color: "Preta" },
      { url: "/products/camiseta-sorria-e-de-graca-2.jpg", color: "Preta" },
      { url: "/products/camiseta-sorria-e-de-graca-3.jpg", color: "Branca" },
      { url: "/products/camiseta-sorria-e-de-graca-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-SORRIA-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-PT-G" },
      { sku: "CAM-SORRIA-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-PT-GG" },
      { sku: "CAM-SORRIA-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-PT-M" },
      { sku: "CAM-SORRIA-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-PT-P" },
      { sku: "CAM-SORRIA-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-PT-XGG" },
      { sku: "CAM-SORRIA-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-BR-G" },
      { sku: "CAM-SORRIA-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-BR-GG" },
      { sku: "CAM-SORRIA-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-BR-M" },
      { sku: "CAM-SORRIA-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-BR-P" },
      { sku: "CAM-SORRIA-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SORRIA-BR-XGG" },
    ],
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
    images: [
      { url: "/products/camiseta-estou-bem-mentira-1.jpg", color: "Preta" },
      { url: "/products/camiseta-estou-bem-mentira-2.jpg", color: "Preta" },
      { url: "/products/camiseta-estou-bem-mentira-3.jpg", color: "Branca" },
      { url: "/products/camiseta-estou-bem-mentira-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-BEM-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-PT-G" },
      { sku: "CAM-BEM-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-PT-GG" },
      { sku: "CAM-BEM-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-PT-M" },
      { sku: "CAM-BEM-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-PT-P" },
      { sku: "CAM-BEM-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-PT-XGG" },
      { sku: "CAM-BEM-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-BR-G" },
      { sku: "CAM-BEM-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-BR-GG" },
      { sku: "CAM-BEM-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-BR-M" },
      { sku: "CAM-BEM-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-BR-P" },
      { sku: "CAM-BEM-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-BEM-BR-XGG" },
    ],
  },
  {
    slug: "camiseta-trabalho-em-equipe",
    name: "Trabalho bem em equipe (sozinho)",
    shortDescription: "Currículo honesto, finalmente.",
    description:
      "A camiseta que seu RH precisava ler antes da contratação. Tecido respirável para reuniões que poderiam ser um e-mail.",
    humor: Humor.SARCASTICO,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "trabalho", "corporativo", "home-office"],
    isFeatured: true,
    rating: 4.7,
    ratingCount: 221,
    images: [
      { url: "/products/camiseta-trabalho-em-equipe-1.jpg", color: "Preta" },
      { url: "/products/camiseta-trabalho-em-equipe-2.jpg", color: "Preta" },
      { url: "/products/camiseta-trabalho-em-equipe-3.jpg", color: "Branca" },
      { url: "/products/camiseta-trabalho-em-equipe-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-EQUIPE-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-PT-G" },
      { sku: "CAM-EQUIPE-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-PT-GG" },
      { sku: "CAM-EQUIPE-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-PT-M" },
      { sku: "CAM-EQUIPE-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-PT-P" },
      { sku: "CAM-EQUIPE-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-PT-XGG" },
      { sku: "CAM-EQUIPE-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-BR-G" },
      { sku: "CAM-EQUIPE-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-BR-GG" },
      { sku: "CAM-EQUIPE-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-BR-M" },
      { sku: "CAM-EQUIPE-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-BR-P" },
      { sku: "CAM-EQUIPE-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-EQUIPE-BR-XGG" },
    ],
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
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "manifesto", "domingo", "colecao-assinatura"],
    isFeatured: true,
    rating: 5,
    ratingCount: 158,
    images: [
      { url: "/products/camiseta-domingo-eterno-1.jpg", color: "Preta" },
      { url: "/products/camiseta-domingo-eterno-2.jpg", color: "Preta" },
      { url: "/products/camiseta-domingo-eterno-3.jpg", color: "Branca" },
      { url: "/products/camiseta-domingo-eterno-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-DOMINGO-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-PT-G" },
      { sku: "CAM-DOMINGO-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-PT-GG" },
      { sku: "CAM-DOMINGO-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-PT-M" },
      { sku: "CAM-DOMINGO-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-PT-P" },
      { sku: "CAM-DOMINGO-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-PT-XGG" },
      { sku: "CAM-DOMINGO-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-BR-G" },
      { sku: "CAM-DOMINGO-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-BR-GG" },
      { sku: "CAM-DOMINGO-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-BR-M" },
      { sku: "CAM-DOMINGO-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-BR-P" },
      { sku: "CAM-DOMINGO-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-DOMINGO-BR-XGG" },
    ],
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
    images: [
      { url: "/products/camiseta-nao-foi-nada-1.jpg", color: "Preta" },
      { url: "/products/camiseta-nao-foi-nada-2.jpg", color: "Preta" },
      { url: "/products/camiseta-nao-foi-nada-3.jpg", color: "Branca" },
      { url: "/products/camiseta-nao-foi-nada-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-NADA-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-PT-G" },
      { sku: "CAM-NADA-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-PT-GG" },
      { sku: "CAM-NADA-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-PT-M" },
      { sku: "CAM-NADA-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-PT-P" },
      { sku: "CAM-NADA-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-PT-XGG" },
      { sku: "CAM-NADA-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-BR-G" },
      { sku: "CAM-NADA-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-BR-GG" },
      { sku: "CAM-NADA-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-BR-M" },
      { sku: "CAM-NADA-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-BR-P" },
      { sku: "CAM-NADA-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-NADA-BR-XGG" },
    ],
  },
  {
    slug: "caneca-primeiro-cafe",
    name: "Antes do café eu não assino contrato",
    shortDescription: "Aviso legal em cerâmica.",
    description:
      "Caneca de cerâmica branca com impressão sublimática. Suporta micro-ondas, lava-louças e sua personalidade matinal.",
    humor: Humor.ACIDO,
    basePriceCents: 6990,
    category: "canecas",
    tags: ["caneca", "cafe", "escritorio", "best-seller"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 603,
    images: [
      { url: "/products/caneca-primeiro-cafe-1.jpg", color: "Branca" },
      { url: "/products/caneca-primeiro-cafe-2.jpg", color: "Branca" },
      { url: "/products/caneca-primeiro-cafe-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAN-CAFE-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450, printProviderVariantId: "CAN-CAFE-325" },
    ],
  },
  {
    slug: "caneca-reuniao-email",
    name: "Isso podia ser um e-mail",
    shortDescription: "Diga sem dizer, em toda call com câmera aberta.",
    description:
      "A caneca mais produtiva do mercado: economiza em média 4 reuniões por semana. Resultado não garantido, mas a intenção é clara.",
    humor: Humor.SARCASTICO,
    basePriceCents: 6990,
    category: "canecas",
    tags: ["caneca", "trabalho", "reuniao", "home-office"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 441,
    images: [
      { url: "/products/caneca-reuniao-email-1.jpg", color: "Branca" },
      { url: "/products/caneca-reuniao-email-2.jpg", color: "Branca" },
      { url: "/products/caneca-reuniao-email-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAN-EMAIL-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450, printProviderVariantId: "CAN-EMAIL-325" },
    ],
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
    images: [
      { url: "/products/caneca-chefe-do-ano-1.jpg", color: "Branca" },
      { url: "/products/caneca-chefe-do-ano-2.jpg", color: "Branca" },
      { url: "/products/caneca-chefe-do-ano-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAN-CHEFE-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450, printProviderVariantId: "CAN-CHEFE-325" },
    ],
  },
  {
    slug: "caneca-lagrimas-dos-meus-inimigos",
    name: "Lágrimas dos meus inimigos (sem açúcar)",
    shortDescription: "Capacidade: 325ml de rancor bem quente.",
    description:
      "Clássico do gênero, revisado. Mantém a bebida na temperatura exata do seu ressentimento por cerca de 20 minutos.",
    humor: Humor.ABSURDO,
    basePriceCents: 6990,
    category: "canecas",
    tags: ["caneca", "absurdo", "classico"],
    rating: 4.7,
    ratingCount: 265,
    images: [
      { url: "/products/caneca-lagrimas-dos-meus-inimigos-1.jpg", color: "Branca" },
      { url: "/products/caneca-lagrimas-dos-meus-inimigos-2.jpg", color: "Branca" },
      { url: "/products/caneca-lagrimas-dos-meus-inimigos-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAN-LAGRIMAS-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450, printProviderVariantId: "CAN-LAGRIMAS-325" },
    ],
  },
  {
    slug: "capa-visto-e-nao-respondido",
    name: "Visto e não respondido",
    shortDescription: "Sua política de comunicação, agora em policarbonato.",
    description:
      "Capa rígida com borda emborrachada e impressão UV. Protege contra quedas de até 1,5m e contra expectativas alheias.",
    humor: Humor.PASSIVO_AGRESSIVO,
    basePriceCents: 9990,
    category: "capas-de-celular",
    tags: ["capa", "celular", "passivo-agressivo", "best-seller"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 389,
    images: [
      "/products/capa-visto-e-nao-respondido-1.jpg",
      "/products/capa-visto-e-nao-respondido-2.jpg",
    ],
    variants: [
      { sku: "CAP-VISTO-IP13", model: "iPhone 13", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP13" },
      { sku: "CAP-VISTO-IP14", model: "iPhone 14", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP14" },
      { sku: "CAP-VISTO-IP15PRO", model: "iPhone 15 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP15PRO" },
      { sku: "CAP-VISTO-IP15", model: "iPhone 15", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP15" },
      { sku: "CAP-VISTO-IP16PROMAX", model: "iPhone 16 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP16PROMAX" },
      { sku: "CAP-VISTO-IP16PRO", model: "iPhone 16 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP16PRO" },
      { sku: "CAP-VISTO-IP16", model: "iPhone 16", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP16" },
      { sku: "CAP-VISTO-IP17PROMAX", model: "iPhone 17 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP17PROMAX" },
      { sku: "CAP-VISTO-IP17PRO", model: "iPhone 17 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP17PRO" },
      { sku: "CAP-VISTO-IP17", model: "iPhone 17", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-IP17" },
      { sku: "CAP-VISTO-GALAXYS25ULTRA", model: "Galaxy S25 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-GALAXYS25ULTRA" },
      { sku: "CAP-VISTO-GALAXYS25", model: "Galaxy S25", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-GALAXYS25" },
      { sku: "CAP-VISTO-GALAXYS23", model: "Galaxy S23", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-GALAXYS23" },
      { sku: "CAP-VISTO-GALAXYS24ULTRA", model: "Galaxy S24 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-GALAXYS24ULTRA" },
      { sku: "CAP-VISTO-GALAXYS24", model: "Galaxy S24", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-VISTO-GALAXYS24" },
    ],
  },
  {
    slug: "capa-bateria-social-2",
    name: "Bateria social: 2%",
    shortDescription: "Ninguém precisa perguntar se você quer sair.",
    description:
      'Capa com acabamento fosco antidigital. Comunica seu limite social antes de qualquer convite para "um rolê rápido".',
    humor: Humor.EXISTENCIAL,
    basePriceCents: 9990,
    category: "capas-de-celular",
    tags: ["capa", "celular", "introvertido", "existencial"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 512,
    images: [
      "/products/capa-bateria-social-2-1.jpg",
      "/products/capa-bateria-social-2-2.jpg",
    ],
    variants: [
      { sku: "CAP-BATERIA-IP13", model: "iPhone 13", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP13" },
      { sku: "CAP-BATERIA-IP14", model: "iPhone 14", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP14" },
      { sku: "CAP-BATERIA-IP15PRO", model: "iPhone 15 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP15PRO" },
      { sku: "CAP-BATERIA-IP15", model: "iPhone 15", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP15" },
      { sku: "CAP-BATERIA-IP16PROMAX", model: "iPhone 16 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP16PROMAX" },
      { sku: "CAP-BATERIA-IP16PRO", model: "iPhone 16 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP16PRO" },
      { sku: "CAP-BATERIA-IP16", model: "iPhone 16", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP16" },
      { sku: "CAP-BATERIA-IP17PROMAX", model: "iPhone 17 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP17PROMAX" },
      { sku: "CAP-BATERIA-IP17PRO", model: "iPhone 17 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP17PRO" },
      { sku: "CAP-BATERIA-IP17", model: "iPhone 17", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-IP17" },
      { sku: "CAP-BATERIA-GALAXYS25ULTRA", model: "Galaxy S25 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-GALAXYS25ULTRA" },
      { sku: "CAP-BATERIA-GALAXYS25", model: "Galaxy S25", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-GALAXYS25" },
      { sku: "CAP-BATERIA-GALAXYS23", model: "Galaxy S23", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-GALAXYS23" },
      { sku: "CAP-BATERIA-GALAXYS24ULTRA", model: "Galaxy S24 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-GALAXYS24ULTRA" },
      { sku: "CAP-BATERIA-GALAXYS24", model: "Galaxy S24", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-BATERIA-GALAXYS24" },
    ],
  },
  {
    slug: "capa-rolando-por-nada",
    name: "Rolando a tela por nada específico",
    shortDescription: "Autoconsciência não cura, mas estampa bem.",
    description:
      "Capa flexível TPU com impressão em alta definição. Acompanha a honestidade que seu tempo de tela merece.",
    humor: Humor.ACIDO,
    basePriceCents: 9990,
    category: "capas-de-celular",
    tags: ["capa", "celular", "internet", "acido"],
    rating: 4.6,
    ratingCount: 143,
    images: [
      "/products/capa-rolando-por-nada-1.jpg",
      "/products/capa-rolando-por-nada-2.jpg",
    ],
    variants: [
      { sku: "CAP-ROLANDO-IP13", model: "iPhone 13", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP13" },
      { sku: "CAP-ROLANDO-IP14", model: "iPhone 14", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP14" },
      { sku: "CAP-ROLANDO-IP15PRO", model: "iPhone 15 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP15PRO" },
      { sku: "CAP-ROLANDO-IP15", model: "iPhone 15", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP15" },
      { sku: "CAP-ROLANDO-IP16PROMAX", model: "iPhone 16 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP16PROMAX" },
      { sku: "CAP-ROLANDO-IP16PRO", model: "iPhone 16 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP16PRO" },
      { sku: "CAP-ROLANDO-IP16", model: "iPhone 16", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP16" },
      { sku: "CAP-ROLANDO-IP17PROMAX", model: "iPhone 17 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP17PROMAX" },
      { sku: "CAP-ROLANDO-IP17PRO", model: "iPhone 17 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP17PRO" },
      { sku: "CAP-ROLANDO-IP17", model: "iPhone 17", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-IP17" },
      { sku: "CAP-ROLANDO-GALAXYS25ULTRA", model: "Galaxy S25 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-GALAXYS25ULTRA" },
      { sku: "CAP-ROLANDO-GALAXYS25", model: "Galaxy S25", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-GALAXYS25" },
      { sku: "CAP-ROLANDO-GALAXYS23", model: "Galaxy S23", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-GALAXYS23" },
      { sku: "CAP-ROLANDO-GALAXYS24ULTRA", model: "Galaxy S24 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-GALAXYS24ULTRA" },
      { sku: "CAP-ROLANDO-GALAXYS24", model: "Galaxy S24", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-ROLANDO-GALAXYS24" },
    ],
  },
  {
    slug: "capa-ja-vou-sair-de-casa",
    name: '"Já estou saindo" (ainda deitado)',
    shortDescription: "A mentira mais democrática do Brasil.",
    description:
      "Capa resistente com proteção de câmera elevada. Para quem calcula o trajeto, mas não levanta.",
    humor: Humor.SARCASTICO,
    basePriceCents: 9990,
    category: "capas-de-celular",
    tags: ["capa", "celular", "atraso", "sarcasmo"],
    rating: 4.7,
    ratingCount: 208,
    images: [
      "/products/capa-ja-vou-sair-de-casa-1.jpg",
      "/products/capa-ja-vou-sair-de-casa-2.jpg",
    ],
    variants: [
      { sku: "CAP-SAINDO-IP13", model: "iPhone 13", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP13" },
      { sku: "CAP-SAINDO-IP14", model: "iPhone 14", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP14" },
      { sku: "CAP-SAINDO-IP15PRO", model: "iPhone 15 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP15PRO" },
      { sku: "CAP-SAINDO-IP15", model: "iPhone 15", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP15" },
      { sku: "CAP-SAINDO-IP16PROMAX", model: "iPhone 16 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP16PROMAX" },
      { sku: "CAP-SAINDO-IP16PRO", model: "iPhone 16 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP16PRO" },
      { sku: "CAP-SAINDO-IP16", model: "iPhone 16", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP16" },
      { sku: "CAP-SAINDO-IP17PROMAX", model: "iPhone 17 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP17PROMAX" },
      { sku: "CAP-SAINDO-IP17PRO", model: "iPhone 17 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP17PRO" },
      { sku: "CAP-SAINDO-IP17", model: "iPhone 17", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-IP17" },
      { sku: "CAP-SAINDO-GALAXYS25ULTRA", model: "Galaxy S25 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-GALAXYS25ULTRA" },
      { sku: "CAP-SAINDO-GALAXYS25", model: "Galaxy S25", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-GALAXYS25" },
      { sku: "CAP-SAINDO-GALAXYS23", model: "Galaxy S23", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-GALAXYS23" },
      { sku: "CAP-SAINDO-GALAXYS24ULTRA", model: "Galaxy S24 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-GALAXYS24ULTRA" },
      { sku: "CAP-SAINDO-GALAXYS24", model: "Galaxy S24", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-SAINDO-GALAXYS24" },
    ],
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
    images: [
      { url: "/products/camiseta-voce-nao-devia-estar-aqui-1.jpg", color: "Preta" },
      { url: "/products/camiseta-voce-nao-devia-estar-aqui-2.jpg", color: "Preta" },
      { url: "/products/camiseta-voce-nao-devia-estar-aqui-3.jpg", color: "Branca" },
      { url: "/products/camiseta-voce-nao-devia-estar-aqui-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-SECRETA-PT-G", size: "G", color: "Preta", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-PT-G" },
      { sku: "CAM-SECRETA-PT-GG", size: "GG", color: "Preta", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-PT-GG" },
      { sku: "CAM-SECRETA-PT-M", size: "M", color: "Preta", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-PT-M" },
      { sku: "CAM-SECRETA-PT-P", size: "P", color: "Preta", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-PT-P" },
      { sku: "CAM-SECRETA-PT-XGG", size: "XGG", color: "Preta", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-PT-XGG" },
      { sku: "CAM-SECRETA-BR-G", size: "G", color: "Branca", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-BR-G" },
      { sku: "CAM-SECRETA-BR-GG", size: "GG", color: "Branca", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-BR-GG" },
      { sku: "CAM-SECRETA-BR-M", size: "M", color: "Branca", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-BR-M" },
      { sku: "CAM-SECRETA-BR-P", size: "P", color: "Branca", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-BR-P" },
      { sku: "CAM-SECRETA-BR-XGG", size: "XGG", color: "Branca", priceCents: 11990, weightGrams: 250, printProviderVariantId: "CAM-SECRETA-BR-XGG" },
    ],
  },

  {
    slug: "moletom-socialmente-indisponivel",
    name: "Socialmente indisponível",
    shortDescription: "Capuz para não ser reconhecido no próprio aniversário.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Recomendado para aniversários, reuniões de condomínio e qualquer convite que comece com 'é rapidinho'.",
    humor: Humor.SARCASTICO,
    basePriceCents: 21990,
    category: "moletons",
    tags: ["moletom", "introversao", "capuz", "frio"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 12,
    images: [
      { url: "/products/moletom-socialmente-indisponivel-1.jpg", color: "Preta" },
      { url: "/products/moletom-socialmente-indisponivel-2.jpg", color: "Preta" },
      { url: "/products/moletom-socialmente-indisponivel-3.jpg", color: "Marinho" },
      { url: "/products/moletom-socialmente-indisponivel-4.jpg", color: "Marinho" },
    ],
    variants: [
      { sku: "MOL-INDISP-PT-XGG", size: "XGG", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-PT-XGG" },
      { sku: "MOL-INDISP-PT-G", size: "G", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-PT-G" },
      { sku: "MOL-INDISP-PT-M", size: "M", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-PT-M" },
      { sku: "MOL-INDISP-PT-P", size: "P", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-PT-P" },
      { sku: "MOL-INDISP-PT-GG", size: "GG", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-PT-GG" },
      { sku: "MOL-INDISP-MA-XGG", size: "XGG", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-MA-XGG" },
      { sku: "MOL-INDISP-MA-G", size: "G", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-MA-G" },
      { sku: "MOL-INDISP-MA-M", size: "M", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-MA-M" },
      { sku: "MOL-INDISP-MA-P", size: "P", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-MA-P" },
      { sku: "MOL-INDISP-MA-GG", size: "GG", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-INDISP-MA-GG" },
    ],
  },
  {
    slug: "moletom-domingo-18h",
    name: "Domingo, 18h. Pronto para o pânico",
    shortDescription: "A abertura do Fantástico, agora com capuz.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Quentinho o bastante para enfrentar a segunda-feira, ou pelo menos para fingir.",
    humor: Humor.EXISTENCIAL,
    basePriceCents: 21990,
    category: "moletons",
    tags: ["moletom", "domingo", "segunda-feira", "ansiedade"],
    isFeatured: false,
    rating: 4.8,
    ratingCount: 9,
    images: [
      { url: "/products/moletom-domingo-18h-1.jpg", color: "Preta" },
      { url: "/products/moletom-domingo-18h-2.jpg", color: "Preta" },
      { url: "/products/moletom-domingo-18h-3.jpg", color: "Marinho" },
      { url: "/products/moletom-domingo-18h-4.jpg", color: "Marinho" },
    ],
    variants: [
      { sku: "MOL-18H-PT-XGG", size: "XGG", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-PT-XGG" },
      { sku: "MOL-18H-PT-G", size: "G", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-PT-G" },
      { sku: "MOL-18H-PT-M", size: "M", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-PT-M" },
      { sku: "MOL-18H-PT-P", size: "P", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-PT-P" },
      { sku: "MOL-18H-PT-GG", size: "GG", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-PT-GG" },
      { sku: "MOL-18H-MA-XGG", size: "XGG", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-MA-XGG" },
      { sku: "MOL-18H-MA-G", size: "G", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-MA-G" },
      { sku: "MOL-18H-MA-M", size: "M", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-MA-M" },
      { sku: "MOL-18H-MA-P", size: "P", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-MA-P" },
      { sku: "MOL-18H-MA-GG", size: "GG", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-18H-MA-GG" },
    ],
  },
  {
    slug: "garrafa-hidratado-e-cansado",
    name: "Hidratado e ainda assim cansado",
    shortDescription: "Dois litros por dia e nenhuma melhora.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Mantém a água gelada por horas. A disposição, infelizmente, não acompanha.",
    humor: Humor.ABSURDO,
    basePriceCents: 21990,
    category: "garrafas",
    tags: ["garrafa", "agua", "cansaco", "academia"],
    isFeatured: true,
    rating: 4.7,
    ratingCount: 8,
    images: [
      { url: "/products/garrafa-hidratado-e-cansado-1.jpg", color: "Preta" },
      { url: "/products/garrafa-hidratado-e-cansado-2.jpg", color: "Preta" },
      { url: "/products/garrafa-hidratado-e-cansado-3.jpg", color: "Branca" },
      { url: "/products/garrafa-hidratado-e-cansado-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "GAR-CANSADO-PT", size: "500ml", color: "Preta", priceCents: 21990, weightGrams: 400, printProviderVariantId: "GAR-CANSADO-PT" },
      { sku: "GAR-CANSADO-BR", size: "500ml", color: "Branca", priceCents: 21990, weightGrams: 400, printProviderVariantId: "GAR-CANSADO-BR" },
    ],
  },
  {
    slug: "garrafa-bebendo-agua-para-nao-responder",
    name: "Bebendo água para não responder",
    shortDescription: "Cada gole é uma resposta que você não deu.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Ideal para reuniões: enquanto você bebe, ninguém espera que você fale.",
    humor: Humor.PASSIVO_AGRESSIVO,
    basePriceCents: 21990,
    category: "garrafas",
    tags: ["garrafa", "agua", "trabalho", "reuniao"],
    isFeatured: false,
    rating: 4.9,
    ratingCount: 6,
    images: [
      { url: "/products/garrafa-bebendo-agua-para-nao-responder-1.jpg", color: "Preta" },
      { url: "/products/garrafa-bebendo-agua-para-nao-responder-2.jpg", color: "Preta" },
      { url: "/products/garrafa-bebendo-agua-para-nao-responder-3.jpg", color: "Branca" },
      { url: "/products/garrafa-bebendo-agua-para-nao-responder-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "GAR-AGUA-PT", size: "500ml", color: "Preta", priceCents: 21990, weightGrams: 400, printProviderVariantId: "GAR-AGUA-PT" },
      { sku: "GAR-AGUA-BR", size: "500ml", color: "Branca", priceCents: 21990, weightGrams: 400, printProviderVariantId: "GAR-AGUA-BR" },
    ],
  },
  {
    slug: "camiseta-kkkkkkkkk-chorei",
    name: "KKKKKKKKK (chorei)",
    shortDescription: "A risada que todo mundo digita e ninguém dá de verdade.",
    description:
      "Camiseta 100% algodão com estampa DTG. Para quem responde tudo com uma fileira de K e uma lágrima discreta no canto do olho.",
    humor: Humor.MEMES,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "memes", "internet", "risada"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 23,
    images: [
      { url: "/products/camiseta-kkkkkkkkk-chorei-1.jpg", color: "Preta" },
      { url: "/products/camiseta-kkkkkkkkk-chorei-2.jpg", color: "Preta" },
      { url: "/products/camiseta-kkkkkkkkk-chorei-3.jpg", color: "Branca" },
      { url: "/products/camiseta-kkkkkkkkk-chorei-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-KKK-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-PT-G" },
      { sku: "CAM-KKK-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-PT-GG" },
      { sku: "CAM-KKK-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-PT-M" },
      { sku: "CAM-KKK-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-PT-P" },
      { sku: "CAM-KKK-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-PT-XGG" },
      { sku: "CAM-KKK-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-BR-G" },
      { sku: "CAM-KKK-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-BR-GG" },
      { sku: "CAM-KKK-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-BR-M" },
      { sku: "CAM-KKK-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-BR-P" },
      { sku: "CAM-KKK-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-KKK-BR-XGG" },
    ],
  },
  {
    slug: "camiseta-sextou-e-terca",
    name: "Sextou (é terça)",
    shortDescription: "O espírito de sexta, com dois dias de antecedência.",
    description:
      "Camiseta 100% algodão com estampa DTG. Para quem começa a semana já contando os minutos e não vê problema nenhum nisso.",
    humor: Humor.MEMES,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "memes", "sextou", "trabalho"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 31,
    images: [
      { url: "/products/camiseta-sextou-e-terca-1.jpg", color: "Preta" },
      { url: "/products/camiseta-sextou-e-terca-2.jpg", color: "Preta" },
      { url: "/products/camiseta-sextou-e-terca-3.jpg", color: "Branca" },
      { url: "/products/camiseta-sextou-e-terca-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-SEXTOU-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-PT-G" },
      { sku: "CAM-SEXTOU-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-PT-GG" },
      { sku: "CAM-SEXTOU-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-PT-M" },
      { sku: "CAM-SEXTOU-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-PT-P" },
      { sku: "CAM-SEXTOU-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-PT-XGG" },
      { sku: "CAM-SEXTOU-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-BR-G" },
      { sku: "CAM-SEXTOU-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-BR-GG" },
      { sku: "CAM-SEXTOU-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-BR-M" },
      { sku: "CAM-SEXTOU-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-BR-P" },
      { sku: "CAM-SEXTOU-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250, printProviderVariantId: "CAM-SEXTOU-BR-XGG" },
    ],
  },
  {
    slug: "caneca-aceita-que-doi-menos",
    name: "Aceita que dói menos (dói igual)",
    shortDescription: "O conselho que todo mundo dá e ninguém consegue seguir.",
    description:
      "Caneca de cerâmica branca de 325 ml com a frase nos dois lados (destro e canhoto). Vai ao micro-ondas e à lava-louças. A dor continua igual.",
    humor: Humor.MEMES,
    basePriceCents: 6990,
    category: "canecas",
    tags: ["caneca", "memes", "cafe", "conselho"],
    isFeatured: false,
    rating: 4.7,
    ratingCount: 14,
    images: [
      { url: "/products/caneca-aceita-que-doi-menos-1.jpg", color: "Branca" },
      { url: "/products/caneca-aceita-que-doi-menos-2.jpg", color: "Branca" },
      { url: "/products/caneca-aceita-que-doi-menos-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAN-ACEITA-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450, printProviderVariantId: "CAN-ACEITA-325" },
    ],
  },
  {
    slug: "capa-erro-404-vontade",
    name: "Erro 404: vontade não encontrada",
    shortDescription: "O servidor da disposição está fora do ar.",
    description:
      "Capa transparente resistente com acabamento brilhante. Avisa a todos, antes do convite, que a página da vontade foi removida ou nunca existiu.",
    humor: Humor.MEMES,
    basePriceCents: 9990,
    category: "capas-de-celular",
    tags: ["capa", "celular", "memes", "preguica"],
    isFeatured: true,
    rating: 4.8,
    ratingCount: 19,
    images: [
      "/products/capa-erro-404-vontade-1.jpg",
      "/products/capa-erro-404-vontade-2.jpg",
    ],
    variants: [
      { sku: "CAP-404-IP13", model: "iPhone 13", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP13" },
      { sku: "CAP-404-IP14", model: "iPhone 14", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP14" },
      { sku: "CAP-404-IP15PRO", model: "iPhone 15 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP15PRO" },
      { sku: "CAP-404-IP15", model: "iPhone 15", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP15" },
      { sku: "CAP-404-IP16PROMAX", model: "iPhone 16 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP16PROMAX" },
      { sku: "CAP-404-IP16PRO", model: "iPhone 16 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP16PRO" },
      { sku: "CAP-404-IP16", model: "iPhone 16", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP16" },
      { sku: "CAP-404-IP17PROMAX", model: "iPhone 17 Pro Max", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP17PROMAX" },
      { sku: "CAP-404-IP17PRO", model: "iPhone 17 Pro", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP17PRO" },
      { sku: "CAP-404-IP17", model: "iPhone 17", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-IP17" },
      { sku: "CAP-404-GALAXYS25ULTRA", model: "Galaxy S25 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-GALAXYS25ULTRA" },
      { sku: "CAP-404-GALAXYS25", model: "Galaxy S25", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-GALAXYS25" },
      { sku: "CAP-404-GALAXYS23", model: "Galaxy S23", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-GALAXYS23" },
      { sku: "CAP-404-GALAXYS24ULTRA", model: "Galaxy S24 Ultra", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-GALAXYS24ULTRA" },
      { sku: "CAP-404-GALAXYS24", model: "Galaxy S24", priceCents: 9990, weightGrams: 60, printProviderVariantId: "CAP-404-GALAXYS24" },
    ],
  },
  {
    slug: "moletom-audio-de-7-minutos",
    name: "Mandei áudio de 7 minutos (ouve no 2x)",
    shortDescription: "Para quem não sabe resumir e tem orgulho disso.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Quentinho o bastante para gravar mais um áudio enquanto espera o ônibus.",
    humor: Humor.MEMES,
    basePriceCents: 21990,
    category: "moletons",
    tags: ["moletom", "memes", "audio", "whatsapp"],
    isFeatured: false,
    rating: 4.9,
    ratingCount: 11,
    images: [
      { url: "/products/moletom-audio-de-7-minutos-1.jpg", color: "Preta" },
      { url: "/products/moletom-audio-de-7-minutos-2.jpg", color: "Preta" },
      { url: "/products/moletom-audio-de-7-minutos-3.jpg", color: "Marinho" },
      { url: "/products/moletom-audio-de-7-minutos-4.jpg", color: "Marinho" },
    ],
    variants: [
      { sku: "MOL-AUDIO-PT-XGG", size: "XGG", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-PT-XGG" },
      { sku: "MOL-AUDIO-PT-G", size: "G", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-PT-G" },
      { sku: "MOL-AUDIO-PT-M", size: "M", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-PT-M" },
      { sku: "MOL-AUDIO-PT-P", size: "P", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-PT-P" },
      { sku: "MOL-AUDIO-PT-GG", size: "GG", color: "Preta", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-PT-GG" },
      { sku: "MOL-AUDIO-MA-XGG", size: "XGG", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-MA-XGG" },
      { sku: "MOL-AUDIO-MA-G", size: "G", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-MA-G" },
      { sku: "MOL-AUDIO-MA-M", size: "M", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-MA-M" },
      { sku: "MOL-AUDIO-MA-P", size: "P", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-MA-P" },
      { sku: "MOL-AUDIO-MA-GG", size: "GG", color: "Marinho", priceCents: 21990, weightGrams: 650, printProviderVariantId: "MOL-AUDIO-MA-GG" },
    ],
  },
];
