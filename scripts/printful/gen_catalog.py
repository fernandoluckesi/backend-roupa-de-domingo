"""Gera backend/prisma/catalog.ts a partir do seed atual + manifests da Printful.
Uso: python -I gen_catalog.py <seed.ts> <printful-manifest.json> <mockups-manifest.json> <saida catalog.ts>
"""
import json
import re
import sys

seed_path, pf_path, mk_path, out_path = sys.argv[1:5]
seed = open(seed_path, encoding="utf8").read()
pf = json.load(open(pf_path, encoding="utf8"))
mk = json.load(open(mk_path, encoding="utf8"))

PRICE = {"camiseta": 8990, "moletom": 21990, "caneca": 6990, "capa": 9990, "garrafa": 21990}
WEIGHT = {"camiseta": 250, "moletom": 650, "caneca": 450, "capa": 60, "garrafa": 400}

cats_start = seed.index("const CATEGORIES = [")
prods_start = seed.index("const PRODUCTS: ProductSeed[] = [")
prods_end = seed.index("const COUPONS = [")
categories_txt = seed[cats_start:prods_start].strip()
products_txt = seed[prods_start:prods_end].strip()

categories_txt = categories_txt.replace(
    """  {
    slug: "secretos",""",
    """  {
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
    slug: "secretos",""",
).replace("position: 4,\n  },\n];", "position: 6,\n  },\n];")
categories_txt = re.sub(r'(slug: "secretos",[\s\S]*?position: )4', r"\g<1>6", categories_txt)

NEW_PRODUCTS = """
  {
    slug: "moletom-socialmente-indisponivel",
    name: "Socialmente indisponível",
    shortDescription: "Capuz para não ser reconhecido no próprio aniversário.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Recomendado para aniversários, reuniões de condomínio e qualquer convite que comece com 'é rapidinho'.",
    humor: Humor.SARCASTICO,
    basePriceCents: 0,
    category: "moletons",
    tags: ["moletom", "introversao", "capuz", "frio"],
    isFeatured: true,
    rating: 4.9,
    ratingCount: 12,
    images: [],
    variants: [],
  },
  {
    slug: "moletom-domingo-18h",
    name: "Domingo, 18h. Pronto para o pânico",
    shortDescription: "A abertura do Fantástico, agora com capuz.",
    description:
      "Moletom canguru com capuz, 50% algodão e 50% poliéster, estampa DTG na frente. Quentinho o bastante para enfrentar a segunda-feira, ou pelo menos para fingir.",
    humor: Humor.EXISTENCIAL,
    basePriceCents: 0,
    category: "moletons",
    tags: ["moletom", "domingo", "segunda-feira", "ansiedade"],
    isFeatured: false,
    rating: 4.8,
    ratingCount: 9,
    images: [],
    variants: [],
  },
  {
    slug: "garrafa-hidratado-e-cansado",
    name: "Hidratado e ainda assim cansado",
    shortDescription: "Dois litros por dia e nenhuma melhora.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Mantém a água gelada por horas. A disposição, infelizmente, não acompanha.",
    humor: Humor.ABSURDO,
    basePriceCents: 0,
    category: "garrafas",
    tags: ["garrafa", "agua", "cansaco", "academia"],
    isFeatured: true,
    rating: 4.7,
    ratingCount: 8,
    images: [],
    variants: [],
  },
  {
    slug: "garrafa-bebendo-agua-para-nao-responder",
    name: "Bebendo água para não responder",
    shortDescription: "Cada gole é uma resposta que você não deu.",
    description:
      "Garrafa térmica de aço inox com parede dupla, 500 ml. Ideal para reuniões: enquanto você bebe, ninguém espera que você fale.",
    humor: Humor.PASSIVO_AGRESSIVO,
    basePriceCents: 0,
    category: "garrafas",
    tags: ["garrafa", "agua", "trabalho", "reuniao"],
    isFeatured: false,
    rating: 4.9,
    ratingCount: 6,
    images: [],
    variants: [],
  },
"""
products_txt = products_txt.rstrip().rstrip(";").rstrip()
assert products_txt.endswith("]")
products_txt = products_txt[:-1].rstrip() + "\n" + NEW_PRODUCTS + "];"


def replace_block(text, slug):
    m = re.search(r'\n  \{\n    slug: "' + re.escape(slug) + r'",[\s\S]*?\n  \},', text)
    assert m, slug
    block = m.group(0)
    info = pf[slug]
    price = PRICE[info["type"]]
    if slug == "camiseta-voce-nao-devia-estar-aqui":
        price = 11990  # peca secreta (recompensa de easter egg) mantem o preco especial
    block = re.sub(r"basePriceCents: \d+", f"basePriceCents: {price}", block)
    imgs = [
        f'{{ url: "/products/{i["file"]}", color: "{i["color"]}" }}' if i.get("color") else f'"/products/{i["file"]}"'
        for i in mk[slug]
    ]
    images_txt = "images: [\n" + "".join(f"      {i},\n" for i in imgs) + "    ],"
    block = re.sub(r"images: \[[\s\S]*?\],", lambda _m: images_txt, block, count=1)
    variants = []
    for v in info["variants"]:
        parts = [f'sku: "{v["externalId"]}"']
        for key in ("size", "color", "model"):
            if v.get(key):
                parts.append(f'{key}: "{v[key]}"')
        parts.append(f"priceCents: {price}")
        parts.append(f'weightGrams: {WEIGHT[info["type"]]}')
        parts.append(f'printProviderVariantId: "{v["externalId"]}"')
        variants.append("      { " + ", ".join(parts) + " },")
    block = re.sub(r"variants: [^\n]*(\n|$)", "variants: [\n" + "\n".join(variants) + "\n    ],\n", block, count=1)
    return text.replace(m.group(0), block)


for slug in pf:
    products_txt = replace_block(products_txt, slug)

header = '''/**
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
  images: string[];
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

'''
out = header + "export " + categories_txt + "\n\nexport " + products_txt + "\n"
open(out_path, "w", encoding="utf8", newline="\n").write(out)
print("ok", len(pf), "produtos Printful;", out.count("slug: "), "slugs")
