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
  name: string;
  /** Subtítulo do card (igual em todos os produtos da frase) */
  short: string;
  /** Piada que fecha a descrição de cada produto */
  pitch: string;
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
    short: "O som chegou. O conteúdo ficou na portaria.",
    pitch: "Acene com a cabeça, diga \"aham\" e deixe a estampa explicar o resto.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "sinceridade", "unissex"],
  },

  // ------------------------------------------------------------ Sarcástico
  {
    key: "acordei-disposto",
    code: "DISPOSTO",
    name: "Acordei disposto (a voltar a dormir)",
    short: "Energia matinal: 100%, direcionada ao travesseiro.",
    pitch: "Para quem vê o despertador como uma sugestão e a soneca como um direito.",
    humor: Humor.SARCASTICO,
    gender: Gender.MASCULINO,
    tags: ["sarcasmo", "preguica", "segunda-feira"],
  },

  // ------------------------------------------------------------ Existencial
  {
    key: "hoje-eu-so-existo",
    code: "EXISTO",
    name: "Hoje eu só existo (e olhe lá)",
    short: "Meta do dia: respirar e não responder ninguém.",
    pitch: "Para os dias em que levantar da cama já conta como produtividade.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.FEMININO,
    tags: ["existencial", "cansaco", "autocuidado"],
  },

  // ------------------------------------------------------------ Memes

  // ------------------------------------------------------------ Para casais
  {
    key: "a-ultima-palavra-e-minha-em-casa",
    code: "PALAVRA",
    name: "A última palavra é minha em casa (sim sra, não sra)",
    short: "A última palavra é dele. As anteriores, não.",
    pitch: "Para o chefe da família que sempre fala por último: \"sim, senhora\".",
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
    short: "O deploy é que não entendeu o código.",
    pitch: "Para devs que juram que o bug é culpa do servidor, do cache ou da lua.",
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
    short: "Até o choro escolheu outro caminho.",
    pitch: "Para aquele amigo que você ama, apesar de tudo o que o espelho diz.",
    humor: Humor.ACIDO,
    gender: Gender.MASCULINO,
    tags: ["acido", "zoeira", "amigos"],
  },
  {
    key: "tao-feia-que-faz-pipoca",
    featured: true,
    code: "PIPOCA",
    name: "Tão feia que faz pipoca assustando o milho",
    short: "Dispensa panela, óleo e micro-ondas.",
    pitch: "Para a amiga que aguenta a zoeira e devolve em dobro.",
    humor: Humor.ACIDO,
    gender: Gender.FEMININO,
    tags: ["acido", "zoeira", "amigas"],
  },
  {
    key: "teu-cu",
    featured: true,
    code: "TEUCU",
    name: "Teu cu",
    short: "Resposta universal. Serve para qualquer pergunta.",
    pitch: "Argumento final de toda discussão brasileira, agora por escrito.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "zoeira", "palavrao", "unissex"],
  },
  {
    key: "bem-no-ano-do-meu-aniversario",
    featured: true,
    code: "ANIVER",
    name: "Bem no ano do meu aniversário",
    short: "Que coincidência. Todo ano acontece isso.",
    pitch: "Para quem leva tudo para o lado pessoal, inclusive o calendário.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "aniversario", "presente", "unissex"],
  },
  {
    key: "e-de-cair-o-cu-da-bunda",
    featured: true,
    code: "BUNDA",
    name: "É de cair o cu da bunda",
    short: "Espanto em nível anatômico.",
    pitch: "Para as notícias, os boletos e as fofocas que nenhuma outra expressão dá conta.",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    tags: ["memes", "zoeira", "palavrao", "unissex"],
  },
  {
    key: "criticar-e-facil",
    featured: true,
    code: "CRITICA",
    name: "Criticar é fácil. Quero ver fazer pior",
    short: "Um desafio que ninguém deveria aceitar.",
    pitch: "Para quem entrega o mínimo com a confiança de quem sabe que dava para ser pior.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "trabalho", "unissex"],
  },
  {
    key: "se-nao-puder-ajudar-atrapalhe",
    featured: true,
    code: "AJUDAR",
    name: "Se não puder ajudar, atrapalhe. O importante é participar",
    short: "Espírito de equipe, versão sincera.",
    pitch: "Para o colega que está em todas as reuniões e em nenhuma solução.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "trabalho", "equipe", "unissex"],
  },
  {
    key: "diferenca-de-copyright-e-feminista",
    featured: true,
    code: "COPY",
    name: "Qual a diferença de copyright e uma feminista? Copyright tem direitos",
    short: "Piada de mau gosto, assumida.",
    pitch: "Humor ácido sem pedido de desculpas. Use por sua conta e risco.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "humor-negro", "unissex"],
  },
  {
    key: "evite-acidentes-faca-de-proposito",
    featured: true,
    code: "ACIDENTE",
    name: "Evite acidentes. Faça de propósito",
    short: "Planejamento é tudo, até na hora de errar.",
    pitch: "Para quem nunca erra sem querer: é tudo estratégia.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "trabalho", "unissex"],
  },

  // ------------------------------------------------------------ Político: estampa-lista
  {
    key: "13-melhores-frases-ja-ditas",
    code: "13FRASES",
    name: "As 13 melhores frases já ditas (contém ironia)",
    short: "Uma coletânea histórica. Nem precisa dizer de quem.",
    pitch: "Treze frases que entraram para a história, impressas inteiras, e legíveis, no peito.",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    tags: ["politica", "frases", "ironia", "unissex"],
    kinds: ["camisetas", "moletons"],
    isFeatured: true,
    details: "Frases da estampa:\n" + THIRTEEN_QUOTES.map((q, i) => `${i + 1}. "${q}"`).join("\n"),
  },

  // ------------------------------------------------------------ Coleção sem filtro, parte 2 (nov/2026)
  {
    key: "se-eu-gostasse-de-mimimi",
    code: "MIMIMI",
    name: "Se eu gostasse de mimimi eu comprava um gato gago",
    short: "Reclamação aqui só com hora marcada.",
    pitch: "Para quem tem paciência curta e nenhuma vaga para drama.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "zoeira", "unissex"],
  },
  {
    key: "pra-quem-tem-alzheimer-toda-festa-e-surpresa",
    code: "FESTA",
    name: "Pra quem tem Alzheimer toda festa é surpresa",
    short: "Humor de mau gosto, com confete.",
    pitch: "Humor ácido sem pedido de desculpas. Use por sua conta e risco.",
    humor: Humor.ACIDO,
    gender: Gender.UNISSEX,
    tags: ["acido", "humor-negro", "unissex"],
  },
  {
    key: "nunca-uma-melhoria",
    code: "PIORA",
    name: "Nunca uma melhoria. Sempre uma piora",
    short: "Otimismo calibrado pela experiência.",
    pitch: "Para quem já parou de perguntar se dá para piorar, porque sempre dá.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "pessimismo", "unissex"],
  },
  {
    key: "comunista-de-iphone",
    code: "TOSA",
    name: "Comunista de iPhone é igual tosa de porco: muito grito e pouco resultado",
    short: "Revolução parcelada em 12 vezes.",
    pitch: "Para o almoço de família em que alguém vai discordar, e alto.",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    tags: ["politica", "ironia", "unissex"],
  },
  {
    key: "quando-chove-merda-nunca-e-garoa",
    code: "GAROA",
    name: "Quando chove merda nunca é garoa",
    short: "Previsão do tempo para a semana toda.",
    pitch: "Para as fases em que o problema vem em dupla, com juros e na segunda-feira.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.UNISSEX,
    tags: ["existencial", "palavrao", "unissex"],
  },
  {
    key: "mais-inutil-que-feriado-no-domingo",
    code: "FERIADO",
    name: "Mais inútil que feriado no domingo",
    short: "A maior injustiça do calendário.",
    pitch: "Para aquela reunião, aquele colega e aquele feriado que caiu no dia errado.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "feriado", "domingo", "unissex"],
  },
  {
    key: "eu-prefiro-morrer-do-que-perder-a-vida",
    code: "MORRER",
    name: "Eu prefiro morrer do que perder a vida!",
    short: "Estampa desenhada, com a frase mais lógica já dita.",
    pitch: "Para quem toma decisões difíceis com absoluta convicção e nenhum sentido.",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    tags: ["memes", "desenho", "nostalgia", "unissex"],
    kinds: ["camisetas", "moletons", "canecas"],
  },
  {
    key: "diferenca-de-um-soco-e-um-aluno-de-federal",
    code: "SOCO",
    name: "Qual a diferença de um soco e um aluno de uma Federal? O soco pode ser de direita",
    short: "Piada de corredor de universidade, sem diploma.",
    pitch: "Para o almoço de família em que alguém vai discordar, e alto.",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    tags: ["politica", "ironia", "universidade", "unissex"],
  },
  {
    key: "mais-perdido-que-azeitona-na-boca-de-banguelo",
    code: "AZEITONA",
    name: "Mais perdido que azeitona na boca de banguelo",
    short: "Sem rumo, sem apoio e rolando de um lado para o outro.",
    pitch: "Para quem chegou na reunião, na festa ou na vida adulta sem saber o que está acontecendo.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "zoeira", "unissex"],
  },
];
