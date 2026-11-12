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
};

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
];
