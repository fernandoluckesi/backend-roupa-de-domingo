/**
 * Catalogo da loja: fonte unica para o seed (banco vazio) e para o catalog:sync (producao).
 * Producao e envio sao da propria loja: o SKU identifica a peca na lista de producao do backoffice.
 * Imagens: mockups servidos pelo frontend em /products (artes de impressao em /designs).
 */
import { Gender, Humor } from "@prisma/client";

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
  /** Publico-alvo. UNISSEX aparece junto de MASCULINO e de FEMININO na busca. */
  gender: Gender;
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

/** Camiseta original (so branca), nos tamanhos da loja. */
function whiteShirtVariants(prefix: string, priceCents: number): VariantSeed[] {
  return SHIRT_SIZES.map((size) => ({
    sku: `${prefix}-BR-${size}`,
    size,
    color: "Branca",
    priceCents,
    weightGrams: 250,
  }));
}

/** Sigla da cor usada no SKU. */
const COLOR_CODE: Record<string, string> = {
  Preta: "PT",
  Branca: "BR",
  Marinho: "MA",
};

/** Camiseta nas cores informadas, em todos os tamanhos. */
function shirtVariants(
  prefix: string,
  priceCents: number,
  colors: string[] = ["Preta", "Branca"],
): VariantSeed[] {
  return colors.flatMap((color) =>
    SHIRT_SIZES.map((size) => ({
      sku: `${prefix}-${COLOR_CODE[color]}-${size}`,
      size,
      color,
      priceCents,
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
      priceCents,
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
  camisetas: 8990,
  canecas: 6990,
  moletons: 21990,
  garrafas: 21990,
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

export const PRODUCTS: ProductSeed[] = [
  {
    slug: "camiseta-sorria-e-de-graca",
    name: "Sorria, é de graça (o resto não)",
    shortDescription: "A gentileza é gratuita. A camiseta, infelizmente, não.",
    description:
      "Camiseta 100% algodão fio penteado, produzida no Brasil, com estampa DTG na frente. Ideal para quem quer parecer simpático sem se comprometer. Lavar do lado avesso, como suas intenções.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
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
      { sku: "CAM-SORRIA-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SORRIA-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "camiseta-estou-bem-mentira",
    name: "Estou bem (mentira estampada)",
    shortDescription: "Duas palavras, uma vida inteira de negação.",
    description:
      'Para aquele dia em que você responde "tudo ótimo" três vezes antes das 9h. Modelagem reta, gola reforçada, autoestima opcional.',
    humor: Humor.EXISTENCIAL,
    gender: Gender.FEMININO,
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
      { sku: "CAM-BEM-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-BEM-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "camiseta-trabalho-em-equipe",
    name: "Trabalho bem em equipe (sozinho)",
    shortDescription: "Currículo honesto, finalmente.",
    description:
      "A camiseta que seu RH precisava ler antes da contratação. Tecido respirável para reuniões que poderiam ser um e-mail.",
    humor: Humor.SARCASTICO,
    gender: Gender.MASCULINO,
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
      { sku: "CAM-EQUIPE-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-EQUIPE-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "camiseta-roupa-de-domingo",
    name: "Roupa de Domingo (a original)",
    shortDescription: "O nome da loja no peito. Estampada por nós, sob demanda.",
    description:
      "Camiseta branca 100% algodão fio penteado, impressão DTG na frente. Estampada por nós depois da compra e enviada pelos Correios.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.UNISSEX,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "colecao-assinatura", "domingo", "producao-real"],
    isFeatured: true,
    rating: 5,
    ratingCount: 1,
    images: ["/products/camiseta-roupa-de-domingo-1.png"],
    variants: whiteShirtVariants("CAM-RD", 8990),
  },
  {
    slug: "camiseta-domingo-eterno",
    name: "Domingo é uma sensação, não um dia",
    shortDescription: "A ansiedade das 18h de domingo, agora vestível.",
    description:
      "Nossa peça manifesto. Homenageia aquele vazio específico entre o almoço de família e a segunda-feira. Algodão macio, melancolia inclusa.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.UNISSEX,
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
      { sku: "CAM-DOMINGO-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-DOMINGO-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "camiseta-nao-foi-nada",
    name: '"Não foi nada" (era tudo)',
    shortDescription: "Passivo-agressivo em 4 palavras e um parêntese.",
    description:
      "Para quem resolve conflito guardando mágoa com juros compostos. Estampa resistente a 50 lavagens e a pedidos de desculpas.",
    humor: Humor.PARA_CASAIS,
    gender: Gender.UNISSEX,
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
      { sku: "CAM-NADA-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-NADA-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "camiseta-combinamos-de-nao-brigar",
    name: "Combinamos de não brigar em público",
    shortDescription: "Spoiler: a camiseta está falando mais alto.",
    description:
      "Camiseta 100% algodão fio penteado para o casal que resolve tudo com olhar. Funciona melhor em par, mas serve sozinha para quem quer avisar com antecedência.",
    humor: Humor.PARA_CASAIS,
    gender: Gender.UNISSEX,
    basePriceCents: 8990,
    category: "camisetas",
    tags: ["camiseta", "casal", "para-casais", "presente"],
    rating: 4.7,
    ratingCount: 128,
    images: [
      { url: "/products/camiseta-nao-foi-nada-1.jpg", color: "Preta" },
      { url: "/products/camiseta-nao-foi-nada-3.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAM-COMBI-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-COMBI-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    // Vitrine da home: ratingCount alto para entrar no top 8 de findFeatured
    slug: "camiseta-nao-sou-airton-senna",
    name: "Gata, não sou Airton Senna mas quero me acabar nas suas curvas",
    shortDescription: "Cantada de pista molhada, impressa em algodão.",
    description:
      "Camiseta 100% algodão fio penteado, produzida no Brasil, com estampa DTG na frente. Para quem acelera na conversa e freia na hora de assumir. Resultado em pista não garantido; vergonha alheia, sim.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    basePriceCents: PRICE.camisetas,
    category: "camisetas",
    tags: ["camiseta", "cantada", "paquera", "destaque"],
    isFeatured: true,
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
    shortDescription: "Espontaneidade de lâmpada de rua: liga no automático.",
    description:
      "Camiseta 100% algodão fio penteado com estampa DTG na frente. Para quem é autêntico do mesmo jeito que iluminação pública é aconchegante. Combina com sinceridade não solicitada.",
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
    shortDescription: "Para o café que também finge ser artesanal.",
    description:
      "Caneca de cerâmica branca com impressão sublimática, 325 ml. Vai ao micro-ondas e à lava-louças. A naturalidade é discutível; a resistência não.",
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
    shortDescription: "Capuz para a sua espontaneidade de 60 watts.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Esquenta de verdade, ao contrário da sua naturalidade.",
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
    shortDescription: "Hidratação com a mesma sutileza de um refletor.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Mantém a água gelada por horas e a ironia por tempo indeterminado.",
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
    shortDescription: "Um círculo e pronto. Projeto entregue.",
    description:
      "Camiseta 100% algodão fio penteado com estampa DTG na frente. Homenagem a quem entende que o mínimo viável já é o suficiente. Lavar do lado avesso, se der vontade.",
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
    shortDescription: "Café redondo, esforço mínimo.",
    description:
      "Caneca de cerâmica branca com impressão sublimática, 325 ml. O círculo vermelho combina com a sua produtividade antes das dez da manhã.",
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
    shortDescription: "Conforto com esforço criativo de um círculo.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Para dias em que fazer o básico já parece bastante.",
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
    shortDescription: "Bebe água e não desenha mais nada.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Design sóbrio, como manda a inspiração de quem já terminou o trabalho.",
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
    shortDescription: "Aviso prévio em algodão.",
    description:
      "Camiseta 100% algodão fio penteado com estampa DTG na frente. Serve como comunicado oficial para colegas, parentes e qualquer pessoa que comece a frase com 'só uma perguntinha'.",
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
    shortDescription: "Leia antes de puxar assunto na copa.",
    description:
      "Caneca de cerâmica branca com impressão sublimática, 325 ml. Funciona como sinalização de segurança no ambiente de trabalho.",
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
    shortDescription: "Capuz para encurtar a conversa junto.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. O capuz existe para quando o aviso da estampa não for suficiente.",
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
    shortDescription: "Hidrate-se antes de responder.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Beber água não aumenta a paciência, mas ocupa a boca enquanto você pensa.",
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
    shortDescription: "Para o almoço de domingo que vira debate.",
    description:
      "Camiseta 100% algodão fio penteado. Não diz em quem você votou, só avisa que você vai falar sobre isso de qualquer forma. Ideal para reuniões de família com sobremesa tensa.",
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
    slug: "caneca-primeiro-cafe",
    name: "Antes do café eu não assino contrato",
    shortDescription: "Aviso legal em cerâmica.",
    description:
      "Caneca de cerâmica branca com impressão sublimática. Suporta micro-ondas, lava-louças e sua personalidade matinal.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
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
      { sku: "CAN-CAFE-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450 },
    ],
  },
  {
    slug: "caneca-grupo-da-familia-no-zap",
    name: "Li tudo no grupo da família e não respondi",
    shortDescription: "Cerâmica neutra para opinião que não é.",
    description:
      "Caneca de cerâmica branca com impressão sublimática. Aguenta micro-ondas, lava-louças e aquele áudio de cinco minutos sobre política às sete da manhã.",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    basePriceCents: 6990,
    category: "canecas",
    tags: ["caneca", "politico", "familia", "whatsapp"],
    rating: 4.6,
    ratingCount: 203,
    images: [
      { url: "/products/caneca-reuniao-email-1.jpg", color: "Branca" },
      { url: "/products/caneca-reuniao-email-2.jpg", color: "Branca" },
    ],
    variants: [
      { sku: "CAN-GRUPO-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450 },
    ],
  },
  {
    slug: "caneca-reuniao-email",
    name: "Isso podia ser um e-mail",
    shortDescription: "Diga sem dizer, em toda call com câmera aberta.",
    description:
      "A caneca mais produtiva do mercado: economiza em média 4 reuniões por semana. Resultado não garantido, mas a intenção é clara.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
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
      { sku: "CAN-EMAIL-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450 },
    ],
  },
  {
    slug: "caneca-chefe-do-ano",
    name: "Chefe do ano (votação com 1 voto)",
    shortDescription: "O presente de amigo oculto que cria histórico.",
    description:
      "Perfeita para aquele gestor que confunde liderança com reunião às 18h de sexta. Vem em embalagem neutra para negação plausível.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
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
      { sku: "CAN-CHEFE-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450 },
    ],
  },
  {
    slug: "caneca-lagrimas-dos-meus-inimigos",
    name: "Lágrimas dos meus inimigos (sem açúcar)",
    shortDescription: "Capacidade: 325ml de rancor bem quente.",
    description:
      "Clássico do gênero, revisado. Mantém a bebida na temperatura exata do seu ressentimento por cerca de 20 minutos.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
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
      { sku: "CAN-LAGRIMAS-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450 },
    ],
  },
  {
    slug: "camiseta-voce-nao-devia-estar-aqui",
    name: "Você não devia estar aqui",
    shortDescription: "Peça secreta. Encontrada, não comprada.",
    description:
      "Edição limitada que não aparece no catálogo normal. Se você está lendo isto, descobriu easter eggs suficientes para merecer uma camiseta que ninguém vai entender. Exatamente o ponto.",
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
    shortDescription: "Capuz para não ser reconhecido no próprio aniversário.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Recomendado para aniversários, reuniões de condomínio e qualquer convite que comece com 'é rapidinho'.",
    humor: Humor.SARCASTICO,
    gender: Gender.FEMININO,
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
    slug: "moletom-domingo-18h",
    name: "Domingo, 18h. Pronto para o pânico",
    shortDescription: "A abertura do Fantástico, agora com capuz.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Quentinho o bastante para enfrentar a segunda-feira, ou pelo menos para fingir.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.UNISSEX,
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
      { sku: "MOL-18H-PT-XGG", size: "XGG", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-PT-G", size: "G", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-PT-M", size: "M", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-PT-P", size: "P", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-PT-GG", size: "GG", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-MA-XGG", size: "XGG", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-MA-G", size: "G", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-MA-M", size: "M", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-MA-P", size: "P", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-18H-MA-GG", size: "GG", color: "Marinho", priceCents: 21990, weightGrams: 650 },
    ],
  },
  {
    slug: "garrafa-hidratado-e-cansado",
    name: "Hidratado e ainda assim cansado",
    shortDescription: "Dois litros por dia e nenhuma melhora.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Mantém a água gelada por horas. A disposição, infelizmente, não acompanha.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.UNISSEX,
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
      { sku: "GAR-CANSADO-PT", size: "500ml", color: "Preta", priceCents: 21990, weightGrams: 400 },
      { sku: "GAR-CANSADO-BR", size: "500ml", color: "Branca", priceCents: 21990, weightGrams: 400 },
    ],
  },
  {
    slug: "garrafa-bebendo-agua-para-nao-responder",
    name: "Bebendo água para não responder",
    shortDescription: "Cada gole é uma resposta que você não deu.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Ideal para reuniões: enquanto você bebe, ninguém espera que você fale.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
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
      { sku: "GAR-AGUA-PT", size: "500ml", color: "Preta", priceCents: 21990, weightGrams: 400 },
      { sku: "GAR-AGUA-BR", size: "500ml", color: "Branca", priceCents: 21990, weightGrams: 400 },
    ],
  },
  {
    slug: "camiseta-kkkkkkkkk-chorei",
    name: "KKKKKKKKK (chorei)",
    shortDescription: "A risada que todo mundo digita e ninguém dá de verdade.",
    description:
      "Camiseta 100% algodão com estampa DTG. Para quem responde tudo com uma fileira de K e uma lágrima discreta no canto do olho.",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
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
    slug: "camiseta-sextou-e-terca",
    name: "Sextou (é terça)",
    shortDescription: "O espírito de sexta, com dois dias de antecedência.",
    description:
      "Camiseta 100% algodão com estampa DTG. Para quem começa a semana já contando os minutos e não vê problema nenhum nisso.",
    humor: Humor.MEMES,
    gender: Gender.MASCULINO,
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
      { sku: "CAM-SEXTOU-PT-G", size: "G", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-PT-GG", size: "GG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-PT-M", size: "M", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-PT-P", size: "P", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-PT-XGG", size: "XGG", color: "Preta", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-BR-G", size: "G", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-BR-GG", size: "GG", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-BR-M", size: "M", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-BR-P", size: "P", color: "Branca", priceCents: 8990, weightGrams: 250 },
      { sku: "CAM-SEXTOU-BR-XGG", size: "XGG", color: "Branca", priceCents: 8990, weightGrams: 250 },
    ],
  },
  {
    slug: "caneca-aceita-que-doi-menos",
    name: "Aceita que dói menos (dói igual)",
    shortDescription: "O conselho que todo mundo dá e ninguém consegue seguir.",
    description:
      "Caneca de cerâmica branca de 325 ml com a frase nos dois lados (destro e canhoto). Vai ao micro-ondas e à lava-louças. A dor continua igual.",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
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
      { sku: "CAN-ACEITA-325", size: "325ml", color: "Branca", priceCents: 6990, weightGrams: 450 },
    ],
  },
  {
    slug: "moletom-audio-de-7-minutos",
    name: "Mandei áudio de 7 minutos (ouve no 2x)",
    shortDescription: "Para quem não sabe resumir e tem orgulho disso.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Quentinho o bastante para gravar mais um áudio enquanto espera o ônibus.",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
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
      { sku: "MOL-AUDIO-PT-XGG", size: "XGG", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-PT-G", size: "G", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-PT-M", size: "M", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-PT-P", size: "P", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-PT-GG", size: "GG", color: "Preta", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-MA-XGG", size: "XGG", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-MA-G", size: "G", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-MA-M", size: "M", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-MA-P", size: "P", color: "Marinho", priceCents: 21990, weightGrams: 650 },
      { sku: "MOL-AUDIO-MA-GG", size: "GG", color: "Marinho", priceCents: 21990, weightGrams: 650 },
    ],
  },
];
