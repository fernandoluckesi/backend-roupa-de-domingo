/**
 * Busca de produtos por relevancia.
 *
 * O catalogo e pequeno (algumas centenas de produtos), entao a busca roda em memoria sobre os
 * produtos que ja passaram pelos outros filtros. Isso permite regras que o `contains` do banco nao
 * faz:
 * - ignora maiusculas, acentos e pontuacao ("TEu Cu", "tao feio", "e de cair");
 * - casa palavras em qualquer ordem e em qualquer campo ("pipoca milho");
 * - aceita palavra pela metade enquanto a pessoa digita ("pipo") e erro de digitacao ("acidetes", "kuu");
 * - palavra curta ("cu") so casa palavra inteira, para nao trazer "escutei" ou "curta";
 * - tipo de peca na busca ("caneca teu cu") vira preferencia pela categoria, nao texto a procurar;
 * - a frase exata vem primeiro, depois quem tem todas as palavras e, por ultimo, quem tem so parte
 *   delas ("teu cu" traz a camiseta "Teu cu" e depois "E de cair o cu da bunda").
 */

export type SearchableProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  tags: string[];
  category: { slug: string };
};

export type SearchHit = {
  id: string;
  score: number;
  /** Todas as palavras da busca foram encontradas */
  complete: boolean;
};

/** Minusculas, sem acento e sem pontuacao. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const words = (text: string) => normalize(text).split(" ").filter(Boolean);

/** Palavras que nao ajudam a achar a frase sozinhas (mas contam na frase exata). */
const STOPWORDS = new Set(
  "a o as os de da do das dos e um uma uns umas que na no nas nos em pra pro para com por ao aos nao".split(" "),
);

/**
 * Palavras que indicam o tipo de peca. Na busca elas viram preferencia pela categoria (ou pelo
 * prefixo do slug), em vez de texto: a descricao de toda camiseta diz "camiseta".
 */
const PIECE_TERMS: Record<string, (p: SearchableProduct) => boolean> = {};
const isCategory = (slug: string) => (p: SearchableProduct) => p.category.slug === slug;
const hasPrefix = (prefix: string) => (p: SearchableProduct) => p.slug.startsWith(prefix);
for (const term of ["camiseta", "camisetas", "camisa", "camisas", "blusa", "blusinha", "tshirt"])
  PIECE_TERMS[term] = isCategory("camisetas");
for (const term of ["oversized", "oversize"]) PIECE_TERMS[term] = hasPrefix("oversized-");
for (const term of ["moletom", "moletons", "moleton", "casaco", "hoodie", "canguru", "agasalho"])
  PIECE_TERMS[term] = isCategory("moletons");
for (const term of ["careca"]) PIECE_TERMS[term] = hasPrefix("moletom-gola-careca-");
for (const term of ["caneca", "canecas", "xicara", "copo"]) PIECE_TERMS[term] = isCategory("canecas");
for (const term of ["garrafa", "garrafas", "garrafinha", "squeeze", "termica"])
  PIECE_TERMS[term] = isCategory("garrafas");
// Palavras que tambem podem estar numa frase: so viram tipo de peca quando sao a busca inteira
const AMBIGUOUS_PIECE_TERMS = new Set(["copo", "termica", "careca"]);

/** Chave fonetica simples do portugues: "kuu" -> "cu", "xicara" -> "chicara", "ss" -> "s". */
function phonetic(word: string): string {
  return word
    .replace(/^h/, "")
    .replace(/ph/g, "f")
    .replace(/k/g, "c")
    .replace(/qu/g, "c")
    .replace(/w/g, "v")
    .replace(/y/g, "i")
    .replace(/x/g, "ch")
    .replace(/z$/g, "s")
    .replace(/(.)\1+/g, "$1");
}

/** Distancia de edicao com transposicao (Damerau-Levenshtein restrita), com corte em `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

/** Quanto a palavra da busca casa com uma palavra do produto (0 = nao casa, 1 = igual). */
function wordMatch(token: string, word: string): number {
  if (token === word) return 1;
  // Palavra curta so vale inteira (ou com a mesma pronuncia): "cu" nao casa com "escutei"
  if (token.length <= 2) return phonetic(token) === phonetic(word) ? 0.85 : 0;
  if (phonetic(token) === phonetic(word)) return 0.85;
  // Ainda digitando: "pipo" -> "pipoca"
  if (word.startsWith(token)) return 0.75;
  if (token.length >= 4) {
    // Erro de digitacao: uma letra de diferenca (duas em palavras longas)
    const max = token.length >= 7 ? 2 : 1;
    if (editDistance(token, word, max) <= max) return 0.6;
    // Erro de digitacao enquanto ainda digita: "acidet" -> "acidentes"
    if (word.length > token.length && editDistance(token, word.slice(0, token.length), max) <= max) return 0.45;
    // Parte de uma palavra maior: "bagunca" em "baguncado"
    if (word.includes(token)) return 0.35;
  }
  return 0;
}

/** Peso de cada campo: o nome da frase vale mais que o texto da descricao. */
const FIELDS = [
  { key: "name", weight: 10 },
  { key: "tags", weight: 4 },
  { key: "shortDescription", weight: 3 },
  { key: "description", weight: 1 },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

/** Nome sem o sufixo de tipo das pecas derivadas: "Teu cu (oversized)" -> "teu cu". */
const phraseName = (name: string) => normalize(name.replace(/\s*\((oversized|gola careca)\)\s*$/i, ""));

/** Ordem de exibicao entre pecas da mesma frase: camiseta primeiro. */
const PIECE_ORDER = ["camiseta-", "oversized-", "moletom-gola-careca-", "moletom-", "caneca-", "garrafa-"];
const pieceRank = (slug: string) => {
  const i = PIECE_ORDER.findIndex((prefix) => slug.startsWith(prefix));
  return i < 0 ? PIECE_ORDER.length : i;
};

type Prepared = {
  product: SearchableProduct;
  phrase: string;
  fields: Record<FieldKey, string[]>;
};

function prepare(product: SearchableProduct): Prepared {
  return {
    product,
    phrase: phraseName(product.name),
    fields: {
      name: words(product.name),
      tags: product.tags.flatMap((tag) => words(tag.replace(/-/g, " "))),
      shortDescription: words(product.shortDescription),
      description: words(product.description),
    },
  };
}

/** Interpreta a busca: palavras de texto, frase sem os tipos de peca e filtros de tipo. */
export function parseQuery(raw: string) {
  const all = words(raw);
  let pieces: ((p: SearchableProduct) => boolean)[] = [];
  const text: string[] = [];
  for (let i = 0; i < all.length; i++) {
    const word = all[i];
    // "gola careca" e um tipo so
    if (word === "gola" && all[i + 1] === "careca") {
      pieces.push(PIECE_TERMS.careca);
      i++;
      continue;
    }
    const piece = PIECE_TERMS[word];
    if (piece && !(AMBIGUOUS_PIECE_TERMS.has(word) && all.length > 1)) {
      pieces.push(piece);
      continue;
    }
    text.push(word);
  }
  // "moletom gola careca": o tipo mais especifico vence
  if (pieces.includes(PIECE_TERMS.careca)) pieces = pieces.filter((piece) => piece !== PIECE_TERMS.moletom);
  const tokens = text.filter((word) => !STOPWORDS.has(word));
  return {
    /** Frase digitada sem os tipos de peca, para comparar com o nome inteiro */
    phrase: text.join(" "),
    /** Palavras que precisam ser encontradas (sem artigos e preposicoes) */
    tokens: tokens.length ? tokens : text,
    pieces,
  };
}

/**
 * Pontua e ordena os produtos para a busca. Devolve so quem casa com alguma coisa:
 * primeiro os que tem todas as palavras (frase exata no topo), depois os que tem parte delas.
 */
export function rankProducts(products: SearchableProduct[], raw: string): SearchHit[] {
  const query = parseQuery(raw);
  const prepared = products.map(prepare);

  // Busca so pelo tipo ("canecas"): todos daquele tipo
  if (!query.tokens.length) {
    if (!query.pieces.length) return [];
    return prepared
      .filter(({ product }) => query.pieces.some((piece) => piece(product)))
      .sort((a, b) => a.phrase.localeCompare(b.phrase) || pieceRank(a.product.slug) - pieceRank(b.product.slug))
      .map(({ product }) => ({ id: product.id, score: 1, complete: true }));
  }

  const hits: (SearchHit & { phrase: string; slug: string })[] = [];
  for (const item of prepared) {
    let score = 0;
    let matched = 0;
    let matchedInName = 0;

    for (const token of query.tokens) {
      let best = 0;
      let bestInName = false;
      let bestLevel = 0;
      for (const { key, weight } of FIELDS) {
        let level = 0;
        for (const word of item.fields[key]) {
          const m = wordMatch(token, word);
          if (m > level) level = m;
          if (level === 1) break;
        }
        // Na descricao longa so vale palavra igual ou comeco de palavra: erro de digitacao ali
        // casa com quase tudo
        if (key === "description" && level < 0.75) level = 0;
        if (level * weight > best) {
          best = level * weight;
          bestInName = key === "name";
          bestLevel = level;
        }
      }
      if (best > 0) {
        matched++;
        score += best;
        // Para resultado parcial so vale palavra do nome igual, com o mesmo som ou incompleta
        // (erro de digitacao sozinho traria "melhoria" para quem buscou "milho")
        if (bestInName && bestLevel >= 0.75) matchedInName++;
      }
    }
    if (!matched) continue;

    const complete = matched === query.tokens.length;
    // Resultado parcial (so parte das palavras) so entra se a palavra estiver no nome da frase:
    // "teu cu" traz "E de cair o cu da bunda", mas nao uma frase que so fala disso na descricao
    if (!complete && !matchedInName) continue;

    // Frase exata: igual ao nome, comeca com a busca ou contem a busca inteira
    if (query.phrase) {
      if (item.phrase === query.phrase) score += 100;
      else if (item.phrase.startsWith(`${query.phrase} `)) score += 60;
      else if (` ${item.phrase} `.includes(` ${query.phrase} `)) score += 45;
    }
    // Tipo de peca pedido na busca
    if (query.pieces.length) {
      if (query.pieces.some((piece) => piece(item.product))) score += 30;
      else score -= 5;
    }

    hits.push({ id: item.product.id, score, complete, phrase: item.phrase, slug: item.product.slug });
  }

  return hits
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        b.score - a.score ||
        a.phrase.localeCompare(b.phrase) ||
        pieceRank(a.slug) - pieceRank(b.slug),
    )
    .map(({ id, score, complete }) => ({ id, score, complete }));
}

/** Chave da frase de um produto (slug sem o tipo de peca), para agrupar as sugestoes. */
export function phraseKey(slug: string): string {
  const prefix = PIECE_ORDER.find((p) => slug.startsWith(p));
  return prefix ? slug.slice(prefix.length) : slug;
}

/** Nome da frase sem o sufixo "(oversized)" / "(gola careca)". */
export function cleanPhraseName(name: string): string {
  return name.replace(/\s*\((oversized|gola careca)\)\s*$/i, "");
}
