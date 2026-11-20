/**
 * Coleção de frases de novembro/2026: uma frase por gênero em cada tipo de humor.
 *
 * Cada frase vira produtos conforme o gênero (ver phraseProducts em catalog.ts):
 * - MASCULINO / FEMININO: camiseta e moletom (peças com modelagem);
 * - UNISSEX: camiseta, caneca e garrafa.
 * Assim todo humor tem produto em todas as categorias e todo gênero é coberto.
 *
 * As linhas da arte (lines/small) ficam em scripts/artwork/catalog.json, que gera
 * as artes de impressão e os mockups do site.
 *
 * Avaliações começam zeradas: produto novo não tem nota inventada.
 */
import { Gender, Humor } from "@prisma/client";

export type Phrase = {
  /** Parte do slug depois do tipo (camiseta-<key>, caneca-<key>...) */
  key: string;
  /** Código curto do SKU (CAM-<code>-PT-M) */
  code: string;
  /** Frase da estampa: é o nome de todos os produtos da frase */
  name: string;
  humor: Humor;
  gender: Gender;
  tags: string[];
  /** Camiseta da frase aparece na vitrine da home (destaque) */
  featured?: boolean;
  /** Peças da frase, quando fogem do padrão por gênero */
  kinds?: ("camisetas" | "moletons" | "canecas" | "garrafas")[];
  /** Todas as peças da frase aparecem na vitrine da home (destaque) */
  isFeatured?: boolean;
  /** Texto extra no fim da descrição (ex.: a lista de frases da estampa) */
  details?: string;
  /** Menor tamanho vendido da camiseta (ex.: "G" = só G, GG, EXG, G1, G2 e G3) */
  minSize?: string;
  /** Só a camiseta de algodão: sem a versão oversized derivada dela */
  noOversized?: boolean;
};

/** Estampa-lista: as frases aparecem na arte e, por extenso, na descrição. */
const THIRTEEN_QUOTES = [
  "Se tá caro, não compra.",
  "Se o cara é corintiano, tudo bem.",
  "E lá eu encontro com uma mulherzinha...",
  "Temos quase 30 milhões de pessoas com problema de desequilíbrio de parafuso...",
  "Ainda bem que a natureza criou o monstro do coronavírus.",
  "O conceito de democracia é relativo.",
  "Que monstro vai sair do ventre dessa menina?",
  "Bandido rouba celular para tomar uma cervejinha.",
  "Os usuários são responsáveis pelos traficantes, que são vítimas dos usuários também.",
  "Não vou enganar o povo mais uma vez.",
  "Então ela vai batucar alguma coisa...",
  "Quando é que vai fechar a porteira, companheira?",
  "Não tem nesse país uma viva alma mais honesta do que eu.",
];

export const PHRASES: Phrase[] = [
  // ------------------------------------------------------------ Ácido
  {
    key: "te-ouvi-so-nao-escutei",
    code: "OUVI",
    name: "Te ouvi. Só não escutei.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "sinceridade", "unissex"],
  },

  // ------------------------------------------------------------ Sarcástico
  {
    key: "acordei-disposto",
    code: "DISPOSTO",
    name: "Acordei disposto (a voltar a dormir)",
    humor: Humor.SARCASTICO,
    gender: Gender.MASCULINO,
    tags: ["sarcasmo", "preguica", "segunda-feira"],
  },

  // ------------------------------------------------------------ Existencial
  {
    key: "hoje-eu-so-existo",
    code: "EXISTO",
    name: "Hoje eu só existo (e olhe lá)",
    humor: Humor.EXISTENCIAL,
    gender: Gender.FEMININO,
    tags: ["existencial", "cansaco", "autocuidado"],
  },

  // ------------------------------------------------------------ Memes

  // ------------------------------------------------------------ Para casais
  {
    key: "a-ultima-palavra-e-minha-em-casa",
    code: "PALAVRA",
    name: "Em casa a última palavra é sempre minha (sim sra, não sra)",
    humor: Humor.PARA_CASAIS,
    gender: Gender.MASCULINO,
    tags: ["casal", "namorados", "presente"],
  },

  // ------------------------------------------------------------ Político (sem partido)

  // ------------------------------------------------------------ Nerd
  {
    key: "na-minha-maquina-funciona",
    code: "MAQUINA",
    name: "Na minha máquina funciona",
    humor: Humor.NERD,
    gender: Gender.MASCULINO,
    tags: ["nerd", "programacao", "dev"],
  },
  // ------------------------------------------------------------ Coleção sem filtro (nov/2026)
  {
    key: "tao-feio-que-a-lagrima-sai-pelo-ouvido",
    featured: true,
    code: "FEIO",
    name: "Tão feio que a lágrima sai pelo ouvido pra não passar pelo rosto",
    humor: Humor.ACIDO,
    gender: Gender.MASCULINO,
    tags: ["acido", "zoeira", "amigos"],
  },
  {
    key: "tao-feia-que-faz-pipoca",
    featured: true,
    code: "PIPOCA",
    name: "Tão feia que faz pipoca assustando o milho",
    humor: Humor.ACIDO,
    gender: Gender.FEMININO,
    tags: ["acido", "zoeira", "amigas"],
  },
  {
    key: "teu-cu",
    featured: true,
    code: "TEUCU",
    name: "Teu cu",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "zoeira", "palavrao", "unissex"],
  },
  {
    key: "bem-no-ano-do-meu-aniversario",
    featured: true,
    code: "ANIVER",
    name: "Bem no ano do meu aniversário",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "aniversario", "presente", "unissex"],
  },
  {
    key: "e-de-cair-o-cu-da-bunda",
    featured: true,
    code: "BUNDA",
    name: "É de cair o cu da bunda",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    tags: ["memes", "zoeira", "palavrao", "unissex"],
  },
  {
    key: "criticar-e-facil",
    featured: true,
    code: "CRITICA",
    name: "Criticar é fácil. Quero ver fazer pior",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "trabalho", "unissex"],
  },
  {
    key: "se-nao-puder-ajudar-atrapalhe",
    featured: true,
    code: "AJUDAR",
    name: "Se não puder ajudar, atrapalhe. O importante é participar",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "trabalho", "equipe", "unissex"],
  },
  {
    key: "diferenca-de-copyright-e-feminista",
    featured: true,
    code: "COPY",
    name: "Qual a diferença de copyright e uma feminista? Copyright tem direitos",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "humor-negro", "unissex"],
  },
  {
    key: "evite-acidentes-faca-de-proposito",
    featured: true,
    code: "ACIDENTE",
    name: "Evite acidentes. Faça de propósito",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "trabalho", "unissex"],
  },

  {
    key: "lugar-de-mulher-e-onde-ela-quiser",
    code: "LUGAR",
    name: "Lugar de mulher é... onde ela quiser (lacrei)",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "mulher", "lacrei", "unissex"],
    // So camiseta, nas fotos masculina e feminina
    kinds: ["camisetas"],
    noOversized: true,
  },

  {
    key: "em-terra-de-olho-quem-tem-cego",
    code: "OLHO",
    name: "Em terra de olho quem tem cego errei",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    tags: ["memes", "ditado", "zoeira", "unissex"],
    // Todos os produtos: camiseta (e oversized), moletom (e gola careca), caneca e garrafa
    kinds: ["camisetas", "moletons", "canecas", "garrafas"],
  },

  // ------------------------------------------------------------ Coleção GG (nov/2026): só do G para cima
  {
    key: "sou-gordo-e-nao-nego",
    code: "NEGO",
    name: "Sou gordo e não nego. Como o quanto eu puder",
    humor: Humor.MEMES,
    gender: Gender.MASCULINO,
    tags: ["memes", "comida", "plus-size"],
    kinds: ["camisetas"],
    minSize: "G",
    noOversized: true,
  },
  {
    key: "sou-gordo-mas-posso-emagrecer",
    code: "EMAGRECER",
    name: "Sou gordo mas posso emagrecer. E vc que é feio e pode engordar...",
    humor: Humor.ACIDO,
    gender: Gender.MASCULINO,
    tags: ["acido", "zoeira", "plus-size"],
    kinds: ["camisetas"],
    minSize: "G",
    noOversized: true,
  },
  {
    key: "deita-vai-e-dieta-vem",
    code: "PASTEL",
    name: "Deita vai e dieta vem. Já comi salada, mas prefiro um pastelzinho de Belém",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "comida", "dieta", "plus-size", "unissex"],
    kinds: ["camisetas"],
    minSize: "G",
    noOversized: true,
  },

  // ------------------------------------------------------------ Político: estampa-lista
  {
    key: "13-melhores-frases-ja-ditas",
    code: "13FRASES",
    name: "As 13 melhores frases já ditas (contém ironia)",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    tags: ["politica", "frases", "ironia", "unissex"],
    kinds: ["camisetas", "moletons", "canecas"],
    isFeatured: true,
    details: "Frases da estampa:\n" + THIRTEEN_QUOTES.map((q, i) => `${i + 1}. "${q}"`).join("\n"),
  },

  // ------------------------------------------------------------ Coleção sem filtro, parte 2 (nov/2026)
  {
    key: "se-eu-gostasse-de-mimimi",
    code: "MIMIMI",
    name: "Se eu gostasse de mimimi eu comprava um gato gago",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "zoeira", "unissex"],
  },
  {
    key: "pra-quem-tem-alzheimer-toda-festa-e-surpresa",
    code: "FESTA",
    name: "Pra quem tem Alzheimer toda festa é surpresa",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "humor-negro", "unissex"],
  },
  {
    key: "nunca-uma-melhoria",
    code: "PIORA",
    name: "Nunca uma melhoria. Sempre uma piora",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "pessimismo", "unissex"],
  },
  {
    key: "comunista-de-iphone",
    code: "TOSA",
    name: "Comunista de iPhone é igual tosa de porco: muito grito e pouco resultado",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    tags: ["politica", "ironia", "unissex"],
  },
  {
    key: "quando-chove-merda-nunca-e-garoa",
    code: "GAROA",
    name: "Quando chove merda nunca é garoa",
    humor: Humor.EXISTENCIAL,
    gender: Gender.UNISSEX,
    tags: ["existencial", "palavrao", "unissex"],
  },
  {
    key: "mais-inutil-que-feriado-no-domingo",
    code: "FERIADO",
    name: "Mais inútil que feriado no domingo",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "feriado", "domingo", "unissex"],
  },
  {
    key: "eu-prefiro-morrer-do-que-perder-a-vida",
    code: "MORRER",
    name: "Eu prefiro morrer do que perder a vida!",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    tags: ["memes", "desenho", "nostalgia", "unissex"],
    kinds: ["camisetas", "moletons", "canecas"],
  },
  {
    key: "diferenca-de-um-soco-e-um-aluno-de-federal",
    code: "SOCO",
    name: "Qual a diferença de um soco e um aluno de uma Federal? O soco pode ser de direita",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    tags: ["politica", "ironia", "universidade", "unissex"],
  },
  {
    key: "mais-perdido-que-azeitona-na-boca-de-banguelo",
    code: "AZEITONA",
    name: "Mais perdido que azeitona na boca de banguelo",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "zoeira", "unissex"],
  },
];
