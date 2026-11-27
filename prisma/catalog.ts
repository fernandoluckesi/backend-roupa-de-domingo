/**
 * Catalogo da loja: fonte unica para o seed (banco vazio) e para o catalog:sync (producao).
 * Producao e envio sao da propria loja: o SKU identifica a peca na lista de producao do backoffice.
 * Imagens: mockups servidos pelo frontend em /products (artes de impressao em /designs).
 */
import { Gender, Humor } from "@prisma/client";
import { PHRASES, type Phrase } from "./catalog-phrases";

export type VariantSeed = {
  sku: string;
  size?: string;
  color?: string;
  model?: string;
  priceCents: number;
  weightGrams: number;
};

export type CatalogImage = string | { url: string; color?: string };

/** Campos de ProductImage a partir de uma imagem do catalogo. */
/**
 * Versão das fotos de /products. As fotos são servidas com cache longo (Cloudflare e navegador) e
 * o nome do arquivo não muda quando a foto é gerada de novo; trocar esta versão muda a URL salva no
 * banco (?v=...) e obriga todo mundo a baixar a foto nova.
 * ATUALIZE sempre que regenerar as fotos em frontend/public/products (data da geração).
 */
export const IMAGE_VERSION = "20261119";

const versioned = (url: string) => (url.startsWith("/") && !url.includes("?") ? `${url}?v=${IMAGE_VERSION}` : url);

export function imageFields(image: CatalogImage): { url: string; color: string | null } {
  return typeof image === "string"
    ? { url: versioned(image), color: null }
    : { url: versioned(image.url), color: image.color ?? null };
}

export type ProductSeed = {
  slug: string;
  name: string;
  /** Tipo da peça (ex.: "Moletom gola careca"): fica abaixo do nome no card e na página */
  shortDescription: string;
  /** Material e acabamento da peça; o texto da estampa vai em details */
  description: string;
  humor: Humor;
  /** Publico-alvo. UNISSEX aparece junto de MASCULINO e de FEMININO na busca. */
  gender: Gender;
  basePriceCents: number;
  category: string;
  tags: string[];
  isFeatured?: boolean;
  /** Ordem na vitrine da home (1 = primeiro); vem de FEATURED_ORDER */
  featuredPosition?: number;
  isSecret?: boolean;
  rating: number;
  ratingCount: number;
  /** URL ou { url, color }: com cor, a pagina do produto troca para essa foto ao escolher a cor */
  images: CatalogImage[];
  variants: VariantSeed[];
};

/** Tamanhos do fornecedor: P a GG são padrão; EXG, G1, G2 e G3 são especiais. */
const SHIRT_SIZES = ["P", "M", "G", "GG", "EXG", "G1", "G2", "G3"];
const SPECIAL_SIZES = new Set(["EXG", "G1", "G2", "G3"]);
/** O fornecedor cobra R$ 5 a mais por peça em tamanho especial; na loja o acréscimo é de R$ 10. */
const SPECIAL_SIZE_EXTRA_CENTS = 1000;
const sizePrice = (priceCents: number, size?: string) =>
  priceCents + (size && SPECIAL_SIZES.has(size) ? SPECIAL_SIZE_EXTRA_CENTS : 0);

/** Sigla da cor usada no SKU. */
const COLOR_CODE: Record<string, string> = {
  Preta: "PT",
  Branca: "BR",
  Marinho: "MA",
  Cinza: "CZ",
  "Off-white": "OW",
};

/** Camiseta nas cores informadas, em todos os tamanhos. */
function shirtVariants(
  prefix: string,
  priceCents: number,
  colors: string[] = ["Preta", "Branca"],
  minSize = SHIRT_SIZES[0],
): VariantSeed[] {
  const sizes = SHIRT_SIZES.slice(SHIRT_SIZES.indexOf(minSize));
  if (!sizes.length) throw new Error(`Tamanho desconhecido: ${minSize}`);
  return colors.flatMap((color) =>
    sizes.map((size) => ({
      sku: `${prefix}-${COLOR_CODE[color]}-${size}`,
      size,
      color,
      priceCents: sizePrice(priceCents, size),
      weightGrams: 250,
    })),
  );
}

/** Moletom canguru nas cores informadas, em todos os tamanhos. */
function hoodieVariants(
  prefix: string,
  priceCents: number,
  colors: string[] = ["Preta", "Marinho"],
): VariantSeed[] {
  return colors.flatMap((color) =>
    SHIRT_SIZES.map((size) => ({
      sku: `${prefix}-${COLOR_CODE[color]}-${size}`,
      size,
      color,
      priceCents: sizePrice(priceCents, size),
      weightGrams: 650,
    })),
  );
}

/** Caneca de ceramica 325 ml: tamanho unico. */
function mugVariants(prefix: string, priceCents: number): VariantSeed[] {
  return [
    {
      sku: `${prefix}-325`,
      size: "325ml",
      color: "Branca",
      priceCents,
      weightGrams: 450,
    },
  ];
}

/** Garrafa termica 500 ml, uma variante por cor. */
function bottleVariants(
  prefix: string,
  priceCents: number,
  colors: string[] = ["Preta", "Branca"],
): VariantSeed[] {
  return colors.map((color) => ({
    sku: `${prefix}-${COLOR_CODE[color]}`,
    size: "500ml",
    color,
    priceCents,
    weightGrams: 400,
  }));
}

/**
 * Preco padrao por categoria, para novas frases entrarem alinhadas com o
 * catalogo existente em vez de cada bloco repetir o numero.
 */
const PRICE = {
  camisetas: 9990,
  canecas: 6490,
  moletons: 14490,
  garrafas: 6990,
} as const;

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

/**
 * Produto antes dos textos: nome = frase da estampa; subtítulo e descrição vêm do tipo da peça
 * (productTexts), sem texto extra fora da estampa.
 */
type ProductInput = Omit<ProductSeed, "shortDescription" | "description"> & {
  /** Texto extra no fim da descrição (ex.: a lista de frases da estampa) */
  details?: string;
};

const ITEMS: ProductInput[] = [
  {
    // Vitrine da home: ratingCount alto para entrar no top 8 de findFeatured
    slug: "camiseta-nao-sou-airton-senna",
    name: "Gata, não sou Airton Senna mas quero me acabar nas suas curvas",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.camisetas,
    category: "camisetas",
    tags: ["camiseta", "cantada", "paquera", "destaque"],
    rating: 4.7,
    ratingCount: 268,
    images: [
      { url: "/products/camiseta-domingo-eterno-1.jpg", color: "Preta" },
      { url: "/products/camiseta-domingo-eterno-2.jpg", color: "Preta" },
      { url: "/products/camiseta-domingo-eterno-3.jpg", color: "Branca" },
      { url: "/products/camiseta-domingo-eterno-4.jpg", color: "Branca" },
    ],
    variants: shirtVariants("CAM-SENNA", PRICE.camisetas),
  },

  // --- "Tão natural quanto a luz do poste" nas quatro categorias ---
  {
    slug: "camiseta-natural-quanto-luz-do-poste",
    name: "Tão natural quanto a luz do poste",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.camisetas,
    category: "camisetas",
    tags: ["camiseta", "sarcasmo", "ironia", "unissex"],
    rating: 4.6,
    ratingCount: 74,
    images: [
      { url: "/products/camiseta-trabalho-em-equipe-1.jpg", color: "Preta" },
      { url: "/products/camiseta-trabalho-em-equipe-3.jpg", color: "Branca" },
    ],
    variants: shirtVariants("CAM-POSTE", PRICE.camisetas),
  },
  {
    slug: "caneca-natural-quanto-luz-do-poste",
    name: "Tão natural quanto a luz do poste",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.canecas,
    category: "canecas",
    tags: ["caneca", "sarcasmo", "ironia", "unissex"],
    rating: 4.6,
    ratingCount: 58,
    images: [
      { url: "/products/caneca-reuniao-email-1.jpg", color: "Branca" },
      { url: "/products/caneca-reuniao-email-2.jpg", color: "Branca" },
    ],
    variants: mugVariants("CAN-POSTE", PRICE.canecas),
  },
  {
    slug: "moletom-natural-quanto-luz-do-poste",
    name: "Tão natural quanto a luz do poste",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.moletons,
    category: "moletons",
    tags: ["moletom", "sarcasmo", "ironia", "unissex"],
    rating: 4.7,
    ratingCount: 31,
    images: [
      { url: "/products/moletom-domingo-18h-1.jpg", color: "Preta" },
      { url: "/products/moletom-domingo-18h-3.jpg", color: "Marinho" },
    ],
    variants: hoodieVariants("MOL-POSTE", PRICE.moletons),
  },
  {
    slug: "garrafa-natural-quanto-luz-do-poste",
    name: "Tão natural quanto a luz do poste",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.garrafas,
    category: "garrafas",
    tags: ["garrafa", "sarcasmo", "ironia", "unissex"],
    rating: 4.6,
    ratingCount: 19,
    images: [
      { url: "/products/garrafa-hidratado-e-cansado-1.jpg", color: "Preta" },
      { url: "/products/garrafa-hidratado-e-cansado-3.jpg", color: "Branca" },
    ],
    variants: bottleVariants("GAR-POSTE", PRICE.garrafas),
  },

  // --- "Mais preguiçoso do que o desenhista da bandeira do Japão" ---
  {
    slug: "camiseta-desenhista-da-bandeira-do-japao",
    name: "Mais preguiçoso do que o desenhista da bandeira do Japão",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.camisetas,
    category: "camisetas",
    tags: ["camiseta", "preguica", "design", "unissex"],
    rating: 4.8,
    ratingCount: 112,
    images: [
      { url: "/products/camiseta-kkkkkkkkk-chorei-1.jpg", color: "Preta" },
      { url: "/products/camiseta-kkkkkkkkk-chorei-3.jpg", color: "Branca" },
    ],
    variants: shirtVariants("CAM-JAPAO", PRICE.camisetas),
  },
  {
    slug: "caneca-desenhista-da-bandeira-do-japao",
    name: "Mais preguiçoso do que o desenhista da bandeira do Japão",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.canecas,
    category: "canecas",
    tags: ["caneca", "preguica", "design", "unissex"],
    rating: 4.8,
    ratingCount: 96,
    images: [
      { url: "/products/caneca-primeiro-cafe-1.jpg", color: "Branca" },
      { url: "/products/caneca-primeiro-cafe-2.jpg", color: "Branca" },
    ],
    variants: mugVariants("CAN-JAPAO", PRICE.canecas),
  },
  {
    slug: "moletom-desenhista-da-bandeira-do-japao",
    name: "Mais preguiçoso do que o desenhista da bandeira do Japão",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.moletons,
    category: "moletons",
    tags: ["moletom", "preguica", "design", "unissex"],
    rating: 4.8,
    ratingCount: 27,
    images: [
      { url: "/products/moletom-audio-de-7-minutos-1.jpg", color: "Preta" },
      { url: "/products/moletom-audio-de-7-minutos-3.jpg", color: "Marinho" },
    ],
    variants: hoodieVariants("MOL-JAPAO", PRICE.moletons),
  },
  {
    slug: "garrafa-desenhista-da-bandeira-do-japao",
    name: "Mais preguiçoso do que o desenhista da bandeira do Japão",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.garrafas,
    category: "garrafas",
    tags: ["garrafa", "preguica", "design", "unissex"],
    rating: 4.7,
    ratingCount: 15,
    images: [
      { url: "/products/garrafa-bebendo-agua-para-nao-responder-1.jpg", color: "Preta" },
      { url: "/products/garrafa-bebendo-agua-para-nao-responder-3.jpg", color: "Branca" },
    ],
    variants: bottleVariants("GAR-JAPAO", PRICE.garrafas),
  },

  // --- "Minha paciência está mais curta que coice de porco" ---
  {
    slug: "camiseta-paciencia-coice-de-porco",
    name: "Minha paciência está mais curta que coice de porco",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.camisetas,
    category: "camisetas",
    tags: ["camiseta", "paciencia", "aviso", "unissex"],
    rating: 4.9,
    ratingCount: 143,
    images: [
      { url: "/products/camiseta-estou-bem-mentira-1.jpg", color: "Preta" },
      { url: "/products/camiseta-estou-bem-mentira-3.jpg", color: "Branca" },
    ],
    variants: shirtVariants("CAM-COICE", PRICE.camisetas),
  },
  {
    slug: "caneca-paciencia-coice-de-porco",
    name: "Minha paciência está mais curta que coice de porco",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.canecas,
    category: "canecas",
    tags: ["caneca", "paciencia", "aviso", "trabalho"],
    rating: 4.9,
    ratingCount: 121,
    images: [
      { url: "/products/caneca-aceita-que-doi-menos-1.jpg", color: "Branca" },
      { url: "/products/caneca-aceita-que-doi-menos-2.jpg", color: "Branca" },
    ],
    variants: mugVariants("CAN-COICE", PRICE.canecas),
  },
  {
    slug: "moletom-paciencia-coice-de-porco",
    name: "Minha paciência está mais curta que coice de porco",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.moletons,
    category: "moletons",
    tags: ["moletom", "paciencia", "aviso", "unissex"],
    rating: 4.8,
    ratingCount: 24,
    images: [
      { url: "/products/moletom-socialmente-indisponivel-1.jpg", color: "Preta" },
      { url: "/products/moletom-socialmente-indisponivel-3.jpg", color: "Marinho" },
    ],
    variants: hoodieVariants("MOL-COICE", PRICE.moletons),
  },
  {
    slug: "garrafa-paciencia-coice-de-porco",
    name: "Minha paciência está mais curta que coice de porco",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.garrafas,
    category: "garrafas",
    tags: ["garrafa", "paciencia", "aviso", "unissex"],
    rating: 4.8,
    ratingCount: 17,
    images: [
      { url: "/products/garrafa-hidratado-e-cansado-2.jpg", color: "Preta" },
      { url: "/products/garrafa-hidratado-e-cansado-4.jpg", color: "Branca" },
    ],
    variants: bottleVariants("GAR-COICE", PRICE.garrafas),
  },
  {
    slug: "camiseta-voto-e-secreto-opiniao-nao",
    name: "Meu voto é secreto, minha opinião não",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "politico", "opiniao", "familia"],
    rating: 4.5,
    ratingCount: 186,
    images: [
      { url: "/products/camiseta-sorria-e-de-graca-1.jpg", color: "Preta" },
      { url: "/products/camiseta-sorria-e-de-graca-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-VOTO-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-VOTO-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "camiseta-voce-nao-devia-estar-aqui",
    name: "Você não devia estar aqui",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
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
      { sku: "CAM-SECRETA-PT-G", size: "G", color: "Preta", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-PT-GG", size: "GG", color: "Preta", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-PT-M", size: "M", color: "Preta", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-PT-P", size: "P", color: "Preta", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-PT-XGG", size: "XGG", color: "Preta", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-BR-G", size: "G", color: "Branca", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-BR-GG", size: "GG", color: "Branca", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-BR-M", size: "M", color: "Branca", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-BR-P", size: "P", color: "Branca", priceCents: 11990, weightGrams: 250 },
      { sku: "CAM-SECRETA-BR-XGG", size: "XGG", color: "Branca", priceCents: 11990, weightGrams: 250 },
    ],
  },

  {
    slug: "moletom-socialmente-indisponivel",
    name: "Socialmente indisponível",
    humor: Humor.SARCASTICO,
    gender: Gender.FEMININO,
    basePriceCents: 21990,
    category: "moletons",
    tags: ["moletom", "introversao", "capuz", "frio"],
    rating: 4.9,
    ratingCount: 12,
    images: [
      { url: "/products/moletom-socialmente-indisponivel-1.jpg", color: "Preta" },
      { url: "/products/moletom-socialmente-indisponivel-2.jpg", color: "Preta" },
      { url: "/products/moletom-socialmente-indisponivel-3.jpg", color: "Marinho" },
      { url: "/products/moletom-socialmente-indisponivel-4.jpg", color: "Marinho" },
    ],
    variants: [
      { sku: "MOL-INDISP-PT-XGG", size: "XGG", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-PT-G", size: "G", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-PT-M", size: "M", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-PT-P", size: "P", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-PT-GG", size: "GG", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-MA-XGG", size: "XGG", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-MA-G", size: "G", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-MA-M", size: "M", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-MA-P", size: "P", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-INDISP-MA-GG", size: "GG", color: "Marinho", priceCents: 21990, weightGrams: 650 },
    ],
  },
  {
    slug: "camiseta-kkkkkkkkk-chorei",
    name: "KKKKKKKKK (chorei)",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "memes", "internet", "risada"],
    rating: 4.9,
    ratingCount: 23,
    images: [
      { url: "/products/camiseta-kkkkkkkkk-chorei-1.jpg", color: "Preta" },
      { url: "/products/camiseta-kkkkkkkkk-chorei-2.jpg", color: "Preta" },
      { url: "/products/camiseta-kkkkkkkkk-chorei-3.jpg", color: "Branca" },
      { url: "/products/camiseta-kkkkkkkkk-chorei-4.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-KKK-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-KKK-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "caneca-aceita-que-doi-menos",
    name: "Aceita que dói menos (dói igual)",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    basePriceCents: 6990,
    category: "canecas",
    tags: ["caneca", "memes", "cafe", "conselho"],
    rating: 4.7,
    ratingCount: 14,
    images: [
      { url: "/products/caneca-aceita-que-doi-menos-1.jpg", color: "Branca" },
      { url: "/products/caneca-aceita-que-doi-menos-2.jpg", color: "Branca" },
      { url: "/products/caneca-aceita-que-doi-menos-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAN-ACEITA-325", size: "325ml", color: "Branca", priceCents: 6490, weightGrams: 450 },
    ],
  },
];

// ---------------------------------------------------------------- coleção de frases

type PhraseCategory = "camisetas" | "moletons" | "canecas" | "garrafas";

/** Produtos de cada frase: peças com modelagem para M/F, objetos só na versão unissex. */
function phraseProducts(phrase: Phrase): ProductInput[] {
  const kinds =
    phrase.kinds ??
    (phrase.gender === Gender.UNISSEX
      ? (["camisetas", "canecas", "garrafas"] as const)
      : (["camisetas", "moletons"] as const));

  return (kinds as readonly PhraseCategory[]).map((category): ProductInput => {
    const prefix = { camisetas: "camiseta", moletons: "moletom", canecas: "caneca", garrafas: "garrafa" }[category];
    const slug = `${prefix}-${phrase.key}`;
    const img = (n: number) => `/products/${slug}-${n}.jpg`;
    const base = {
      slug,
      name: phrase.name,
      details: phrase.details,
      humor: phrase.humor,
      gender: phrase.gender,
      basePriceCents: PRICE[category],
      category,
      tags: [prefix, ...phrase.tags],
      isFeatured: phrase.isFeatured,
      rating: 0,
      ratingCount: 0,
    };
    switch (category) {
      case "camisetas":
        return {
          ...base,
          images: [{ url: img(1), color: "Preta" }, { url: img(2), color: "Branca" }],
          // featured: so a camiseta; isFeatured: todas as pecas da frase
          isFeatured: Boolean(phrase.isFeatured || phrase.featured),
          variants: shirtVariants(`CAM-${phrase.code}`, PRICE.camisetas, undefined, phrase.minSize),
        };
      case "moletons":
        return {
          ...base,
          images: [{ url: img(1), color: "Preta" }, { url: img(2), color: "Marinho" }],
          variants: hoodieVariants(`MOL-${phrase.code}`, PRICE.moletons),
        };
      case "canecas":
        return { ...base, images: [img(1)], variants: mugVariants(`CAN-${phrase.code}`, PRICE.canecas) };
      case "garrafas":
        return {
          ...base,
          images: [{ url: img(1), color: "Preta" }, { url: img(2), color: "Branca" }],
          variants: bottleVariants(`GAR-${phrase.code}`, PRICE.garrafas),
        };
    }
  });
}

ITEMS.push(...PHRASES.flatMap(phraseProducts));

/**
 * Camisetas pretas e brancas: fotos com modelo (scripts/artwork/model-mockup.js), uma cor por
 * foto. Masculina usa o modelo, feminina a modelo e unissex os dois. Preta vem primeiro.
 */
const SHIRT_MODELS: Record<Gender, string[]> = {
  [Gender.MASCULINO]: ["m"],
  [Gender.FEMININO]: ["f"],
  [Gender.UNISSEX]: ["m", "f"],
};
const SHIRT_COLORS = [
  { color: "Preta", file: "preta" },
  { color: "Branca", file: "branca" },
];

for (const product of ITEMS) {
  // Pelo slug: a camiseta secreta fica na categoria "secretos"
  if (!product.slug.startsWith("camiseta-")) continue;
  const colors = new Set(product.variants.map((v) => v.color));
  if (!SHIRT_COLORS.every((c) => colors.has(c.color))) continue;
  product.images = SHIRT_COLORS.flatMap(({ color, file }) =>
    SHIRT_MODELS[product.gender].map((model) => ({ url: `/products/${product.slug}-${model}-${file}.jpg`, color })),
  );
}

// ---------------------------------------------------------------- linha do fornecedor (Pikarrucha)

/**
 * Preços de venda por peça, a partir da proposta comercial da Pikarrucha (modelo 1: produção sob
 * demanda e envio ao cliente; estampa A4 frente; camisetas de poliéster ficam de fora).
 *
 * Conta usada: lucro = preço − custo da peça − embalagem − tecnologia − 6% de imposto (Simples)
 * − 5% de taxa de pagamento. Meta: margem líquida média de 10%, sem sair da faixa de mercado.
 * - embalagem: a proposta deixa a embalagem de envio por conta da loja (envelope, caixa, proteção);
 * - tecnologia: R$ 1,50 por pedido (hospedagem, domínio e serviços ≈ R$ 150/mês ÷ 100 pedidos).
 *
 *   peça                     custo  embalagem  empate   preço    lucro   margem
 *   camiseta de algodão      73,00    4,00      88,20    99,90   10,41   10,4%
 *   camiseta oversized       70,00    4,00      84,83    99,90   13,41   13,4%
 *   moletom canguru         105,00    6,00     126,40   144,90   16,46   11,4%
 *   moletom gola careca     100,00    6,00     120,79   134,90   12,56    9,3%
 *   caneca branca            45,00    5,00      57,87    64,90    6,26    9,6%
 *   caneca preta             60,00    5,00      74,72    84,90    9,06   10,7%
 *   caneca mágica preta      55,00    5,00      69,10    77,90    7,83   10,1%
 *   caneca alça de coração   55,00    5,00      69,10    77,90    7,83   10,1%
 *   caneca térmica           85,00    5,00     102,81   114,90   10,76    9,4%
 *   garrafa Queta Soft       50,00    4,00      62,36    69,90    6,71    9,6%
 *   garrafa Norton           60,00    3,00      72,47    82,90    9,28   11,2%   (já vem em caixa kraft)
 *                                                               média  10,5%
 *
 * Tamanhos especiais (EXG, G1, G2, G3): o fornecedor cobra R$ 5 a mais e a loja R$ 10 a mais.
 *
 * Imposto, taxa de pagamento, embalagem e tecnologia são estimativas: ajuste aqui se os números
 * reais mudarem. O frete é cobrado do cliente à parte.
 */
const RETAIL = {
  camiseta: 9990,
  oversized: 9990,
  moletomCanguru: 14490,
  moletomGolaCareca: 13490,
} as const;

/** Modelos de caneca: a "cor" da variante é o modelo, e a página troca a foto ao escolher. */
const MUG_MODELS = [
  { color: "Branca", file: "branca", code: "BR", priceCents: 6490, weightGrams: 450 },
  { color: "Preta", file: "preta", code: "PT", priceCents: 8490, weightGrams: 450 },
  { color: "Mágica preta", file: "magica", code: "MAG", priceCents: 7790, weightGrams: 450 },
  { color: "Térmica preta", file: "termica", code: "TER", priceCents: 11490, weightGrams: 400 },
  { color: "Alça de coração", file: "coracao", code: "COR", priceCents: 7790, weightGrams: 450 },
];

/** Garrafas: Queta Soft 550 ml nas cores do fornecedor e Norton 570 ml (só preta). */
const BOTTLE_MODELS = [
  { color: "Queta Soft preta", file: "queta-preta", code: "QS-PT", priceCents: 6990, weightGrams: 250 },
  { color: "Queta Soft branca", file: "queta-branca", code: "QS-BR", priceCents: 6990, weightGrams: 250 },
  { color: "Queta Soft roxa", file: "queta-roxa", code: "QS-RX", priceCents: 6990, weightGrams: 250 },
  { color: "Queta Soft azul", file: "queta-azul", code: "QS-AZ", priceCents: 6990, weightGrams: 250 },
  { color: "Norton térmica preta", file: "norton", code: "NT-PT", priceCents: 8290, weightGrams: 450 },
];

/** Moletons (canguru e gola careca): a mesma foto para masculino e feminino, uma por cor. */
const SWEATSHIRT_COLORS = [
  { color: "Cinza", file: "cinza" },
  { color: "Preta", file: "preta" },
  { color: "Branca", file: "branca" },
];

/** "CAM-TEUCU-PT-P" -> "TEUCU": código da estampa, sem o tipo e sem cor/tamanho. */
const stampCode = (product: ProductInput, tail: number) =>
  product.variants[0].sku.split("-").slice(1, -tail).join("-");

const setPrice = (product: ProductInput, priceCents: number) => {
  product.basePriceCents = priceCents;
  product.variants = product.variants.map((v) => ({ ...v, priceCents: sizePrice(priceCents, v.size) }));
};

/**
 * Estampas que não saem no moletom canguru: a área entre o cordão do capuz e o bolso é baixa, e a
 * estampa-lista e a estampa desenhada ficam pequenas demais. Elas continuam no gola careca.
 * (mockup.js segue a mesma regra e não gera essas fotos.)
 */
const NO_HOODIE = new Set(["13-melhores-frases-ja-ditas", "eu-prefiro-morrer-do-que-perder-a-vida"]);

/** Frases só na camiseta de algodão (sem oversized): noOversized em catalog-phrases.ts. */
const NO_OVERSIZED = new Set(PHRASES.filter((p) => p.noOversized).map((p) => p.key));

const derived: ProductInput[] = [];

for (const product of ITEMS) {
  const [type] = product.slug.split("-");
  const key = product.slug.slice(type.length + 1);

  if (type === "camiseta") {
    setPrice(product, RETAIL.camiseta);
    if (product.isSecret || NO_OVERSIZED.has(key)) continue;
    // Mesma estampa na camiseta oversized (foto da peça, cor única)
    derived.push({
      ...product,
      slug: `oversized-${key}`,
      name: product.name,
      basePriceCents: RETAIL.oversized,
      tags: ["oversized", ...product.tags],
      isFeatured: false,
      rating: 0,
      ratingCount: 0,
      images: [{ url: `/products/oversized-${key}.jpg`, color: "Off-white" }],
      variants: shirtVariants(`OVS-${stampCode(product, 2)}`, RETAIL.oversized, ["Off-white"]),
    });
  }

  if (type === "moletom") {
    const code = stampCode(product, 2);
    const colors = SWEATSHIRT_COLORS.map((c) => c.color);
    product.basePriceCents = RETAIL.moletomCanguru;
    product.variants = hoodieVariants(`MOL-${code}`, RETAIL.moletomCanguru, colors);
    product.images = SWEATSHIRT_COLORS.map(({ color, file }) => ({ url: `/products/${product.slug}-${file}.jpg`, color }));
    // Mesma estampa no moletom gola careca (sem capuz)
    derived.push({
      ...product,
      slug: `moletom-gola-careca-${key}`,
      name: product.name,
      basePriceCents: RETAIL.moletomGolaCareca,
      tags: ["gola-careca", ...product.tags],
      isFeatured: false,
      rating: 0,
      ratingCount: 0,
      images: SWEATSHIRT_COLORS.map(({ color, file }) => ({ url: `/products/moletom-gola-careca-${key}-${file}.jpg`, color })),
      variants: hoodieVariants(`MGC-${code}`, RETAIL.moletomGolaCareca, colors),
    });
  }

  if (type === "caneca") {
    const code = stampCode(product, 1);
    product.basePriceCents = Math.min(...MUG_MODELS.map((m) => m.priceCents));
    product.variants = MUG_MODELS.map((m) => ({
      sku: `CAN-${code}-${m.code}`,
      color: m.color,
      priceCents: m.priceCents,
      weightGrams: m.weightGrams,
    }));
    product.images = MUG_MODELS.map((m) => ({ url: `/products/${product.slug}-${m.file}.jpg`, color: m.color }));
  }

  if (type === "garrafa") {
    const code = stampCode(product, 1);
    product.basePriceCents = Math.min(...BOTTLE_MODELS.map((m) => m.priceCents));
    product.variants = BOTTLE_MODELS.map((m) => ({
      sku: `GAR-${code}-${m.code}`,
      color: m.color,
      priceCents: m.priceCents,
      weightGrams: m.weightGrams,
    }));
    product.images = BOTTLE_MODELS.map((m) => ({ url: `/products/${product.slug}-${m.file}.jpg`, color: m.color }));
  }
}

/**
 * Moletom canguru fora de venda por enquanto (26/11/2026): os produtos saem do site e o
 * catalog:sync marca os que ja existiam como inativos, sem apagar pedidos antigos. Os moletons
 * gola careca continuam, porque sao gerados a partir das mesmas entradas "moletom-" acima.
 * Para voltar a vender, troque para true (as fotos e as artes continuam sendo geradas).
 */
const SELL_HOODIE = false;

for (let i = ITEMS.length - 1; i >= 0; i--) {
  const slug = ITEMS[i].slug;
  if (!slug.startsWith("moletom-")) continue;
  const key = slug.slice("moletom-".length);
  if (!SELL_HOODIE || NO_HOODIE.has(key)) ITEMS.splice(i, 1);
}

ITEMS.push(...derived);

// ---------------------------------------------------------------- textos

/**
 * Subtítulo (tipo da peça) e descrição (material) pelo prefixo do slug. A ordem importa:
 * "moletom-gola-careca-" antes de "moletom-".
 */
const PIECE_TEXTS: { prefix: string; short: string; description: string }[] = [
  {
    prefix: "oversized-",
    short: "Camiseta oversized",
    description: "Camiseta oversized em algodão, com modelagem ampla e estampa DTF na frente.",
  },
  {
    prefix: "moletom-gola-careca-",
    short: "Moletom gola careca",
    description: "Moletom gola careca em algodão, sem capuz, com estampa DTF na frente.",
  },
  {
    prefix: "moletom-",
    short: "Moletom canguru",
    description: "Moletom canguru com capuz, em algodão, com estampa DTF na frente.",
  },
  {
    prefix: "camiseta-",
    short: "Camiseta de algodão",
    description: "Camiseta 100% algodão fio penteado com estampa DTF na frente.",
  },
  {
    prefix: "caneca-",
    short: "Caneca",
    description:
      "Caneca em cinco modelos: branca, preta, mágica (preta quando fria), térmica e com alça de coração.",
  },
  {
    prefix: "garrafa-",
    short: "Garrafa",
    description:
      "Garrafa em dois modelos: Queta Soft (alumínio emborrachado com tampa de bambu, 550 ml) ou Norton (térmica de aço inox com parede dupla, 570 ml).",
  },
];

function productTexts({ details, ...product }: ProductInput): ProductSeed {
  const piece = PIECE_TEXTS.find((t) => product.slug.startsWith(t.prefix));
  if (!piece) throw new Error(`Tipo de peça desconhecido: ${product.slug}`);
  return {
    ...product,
    shortDescription: piece.short,
    description: details ? `${piece.description}\n\n${details}` : piece.description,
  };
}

/** Produtos que abrem a vitrine da home, nesta ordem; os demais destaques vem depois. */
const FEATURED_ORDER = ["camiseta-13-melhores-frases-ja-ditas"];

function featuredPosition(product: ProductSeed): ProductSeed {
  const index = FEATURED_ORDER.indexOf(product.slug);
  return index < 0 ? product : { ...product, isFeatured: true, featuredPosition: index + 1 };
}

export const PRODUCTS: ProductSeed[] = ITEMS.map(productTexts).map(featuredPosition);
