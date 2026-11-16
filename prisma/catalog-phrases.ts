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
  "Um dos países mais respeitados do mundo no crime organizado.",
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
    key: "nao-sou-grosso-sou-eficiente",
    code: "GROSSO",
    name: "Não sou grosso, sou eficiente",
    short: "Economizo palavras. E paciência. E educação.",
    pitch: "Para quem responde em uma palavra e acha que foi gentil por ter respondido.",
    humor: Humor.ACIDO,
    gender: Gender.MASCULINO,
    tags: ["acido", "sinceridade", "presente"],
  },
  {
    key: "delicada-igual-boleto-vencido",
    code: "BOLETO",
    name: "Delicada igual boleto vencido",
    short: "Chega sem avisar e cobra com juros.",
    pitch: "Para quem tem a doçura de uma notificação do banco às 7h da manhã.",
    humor: Humor.ACIDO,
    gender: Gender.FEMININO,
    tags: ["acido", "sinceridade", "presente"],
  },
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
  {
    key: "ja-to-quase-pronta",
    code: "PRONTA",
    name: "Já tô quase pronta (nem tomei banho)",
    short: "\"Quase\" é uma unidade de tempo flexível.",
    pitch: "Para quem diz \"5 minutinhos\" com a confiança de quem nunca usou relógio.",
    humor: Humor.SARCASTICO,
    gender: Gender.FEMININO,
    tags: ["sarcasmo", "atraso", "amigas"],
  },
  {
    key: "parabens-pela-opiniao",
    code: "OPINIAO",
    name: "Parabéns pela opinião (ninguém perguntou)",
    short: "Aplausos educados para comentários não solicitados.",
    pitch: "Ideal para almoço de família, grupo do condomínio e reunião que podia ser um e-mail.",
    humor: Humor.SARCASTICO,
    gender: Gender.UNISSEX,
    tags: ["sarcasmo", "opiniao", "unissex"],
  },

  // ------------------------------------------------------------ Existencial
  {
    key: "ainda-decidindo-o-que-ser",
    code: "CRESCER",
    name: "Ainda decidindo o que ser quando crescer (já cresci)",
    short: "Carreira em fase de testes desde a formatura.",
    pitch: "Para quem tem 30 e poucos anos e um plano de vida em modo rascunho.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.MASCULINO,
    tags: ["existencial", "carreira", "vida-adulta"],
  },
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
  {
    key: "carregando-desde-que-nasci",
    code: "CARREGA",
    name: "Carregando... (desde que nasci)",
    short: "A barra de progresso da vida travou em 12%.",
    pitch: "Para quem sente que o download da vida adulta nunca termina.",
    humor: Humor.EXISTENCIAL,
    gender: Gender.UNISSEX,
    tags: ["existencial", "vida-adulta", "unissex"],
  },

  // ------------------------------------------------------------ Memes
  {
    key: "ta-pago",
    code: "TAPAGO",
    name: "Tá pago (não paguei nada)",
    short: "Treino imaginário, boleto real.",
    pitch: "Para quem posta a foto da academia e passa o resto do dia no sofá.",
    humor: Humor.MEMES,
    gender: Gender.MASCULINO,
    tags: ["memes", "academia", "internet"],
  },
  {
    key: "amiga-senta-que-la-vem-historia",
    code: "AMIGA",
    name: "Amiga, senta que lá vem história",
    short: "Resumo: não tem resumo.",
    pitch: "Para quem conta a fofoca com introdução, desenvolvimento e três temporadas.",
    humor: Humor.MEMES,
    gender: Gender.FEMININO,
    tags: ["memes", "amigas", "fofoca"],
  },
  {
    key: "ninguem-absolutamente-ninguem",
    code: "NINGUEM",
    name: "Ninguém: / Absolutamente ninguém: / Eu:",
    short: "O meme que explica todas as suas decisões.",
    pitch: "Para quem faz as coisas sem ninguém ter pedido, e com orgulho.",
    humor: Humor.MEMES,
    gender: Gender.UNISSEX,
    tags: ["memes", "internet", "unissex"],
  },

  // ------------------------------------------------------------ Para casais
  {
    key: "eu-decido-tudo-em-casa",
    code: "DECIDO",
    name: "Eu decido tudo em casa (depois de pedir permissão)",
    short: "Autoridade máxima, com aprovação prévia.",
    pitch: "Para o chefe da família que confere com o comitê antes de escolher a pizza.",
    humor: Humor.PARA_CASAIS,
    gender: Gender.MASCULINO,
    tags: ["casal", "namorados", "presente"],
  },
  {
    key: "nao-to-brava",
    code: "BRAVA",
    name: "Não tô brava. (Ok.)",
    short: "O ponto final diz tudo.",
    pitch: "Tradução simultânea incluída: \"ok\" com ponto final nunca foi ok.",
    humor: Humor.PARA_CASAIS,
    gender: Gender.FEMININO,
    tags: ["casal", "namorados", "presente"],
  },
  {
    key: "onde-vamos-jantar",
    code: "JANTAR",
    name: "Onde vamos jantar? (discutindo há 3 horas)",
    short: "A maior decisão de todo relacionamento.",
    pitch: "Presente para o casal que já pediu delivery de fome por não decidir o restaurante.",
    humor: Humor.PARA_CASAIS,
    gender: Gender.UNISSEX,
    tags: ["casal", "namorados", "presente", "unissex"],
  },

  // ------------------------------------------------------------ Político (sem partido)
  {
    key: "discuto-politica-so-no-churrasco",
    code: "CHURRAS",
    name: "Discuto política só no churrasco (saí sem carne e sem amigos)",
    short: "Debate acalorado, picanha fria.",
    pitch: "Para quem transforma o almoço de domingo em horário eleitoral gratuito.",
    humor: Humor.POLITICO,
    gender: Gender.MASCULINO,
    tags: ["politica", "churrasco", "familia"],
  },
  {
    key: "meu-voto-vai-pra-soneca",
    code: "SONECA",
    name: "Meu voto vai pra soneca (única que cumpre o que promete)",
    short: "Candidata sem escândalo e com 100% de aprovação.",
    pitch: "Plataforma de governo: mais 10 minutos. Sempre.",
    humor: Humor.POLITICO,
    gender: Gender.FEMININO,
    tags: ["politica", "soneca", "eleicao"],
  },
  {
    key: "promessa-de-campanha",
    code: "PROMESSA",
    name: "Promessa de campanha (igual meu regime: começa segunda)",
    short: "Compromisso firme com a próxima segunda-feira.",
    pitch: "Sem partido, sem lado: só a eterna arte de prometer e adiar.",
    humor: Humor.POLITICO,
    gender: Gender.UNISSEX,
    tags: ["politica", "dieta", "unissex"],
  },

  // ------------------------------------------------------------ Nerd
  {
    key: "na-minha-maquina-funciona",
    code: "MAQUINA",
    name: "Na minha máquina funciona (só nela)",
    short: "O deploy é que não entendeu o código.",
    pitch: "Para devs que juram que o bug é culpa do servidor, do cache ou da lua.",
    humor: Humor.NERD,
    gender: Gender.MASCULINO,
    tags: ["nerd", "programacao", "dev"],
  },
  {
    key: "nao-e-bagunca-e-sistema-de-arquivos",
    code: "ARQUIVOS",
    name: "Não é bagunça, é sistema de arquivos (só eu entendo)",
    short: "Organização por camadas, de roupas na cadeira.",
    pitch: "Para quem acha tudo em 2 segundos numa pilha que ninguém mais ousa tocar.",
    humor: Humor.NERD,
    gender: Gender.FEMININO,
    tags: ["nerd", "tecnologia", "organizacao"],
  },
  {
    key: "ctrl-z-na-segunda-feira",
    code: "CTRLZ",
    name: "Ctrl+Z na segunda-feira (tentei)",
    short: "Desfazer não disponível neste plano de vida.",
    pitch: "Atalho de teclado para todas as decisões tomadas antes do café.",
    humor: Humor.NERD,
    gender: Gender.UNISSEX,
    tags: ["nerd", "tecnologia", "segunda-feira", "unissex"],
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
