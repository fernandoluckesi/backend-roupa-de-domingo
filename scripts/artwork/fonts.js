// Tipografia das estampas: a "marca registrada" do Roupa de Domingo em todas as artes.
//
// - HEADLINE (Titan One): a frase principal, em maiusculas. Gorda e arredondada, le de longe.
// - PUNCHLINE (Pacifico): a frase de baixo, a que completa a piada, em minusculas cursivas.
// - TEXT (Space Grotesk): texto corrido das estampas-lista (as 13 frases), que precisa ser legivel
//   em tamanho pequeno.
// - MEME (Bangers): legenda das estampas com personagem/desenho (layout "image").
//
// Todas sao Google Fonts com licenca SIL OFL (uso comercial liberado). Os arquivos e as licencas
// ficam em frontend/scripts/brand/fonts e sao copiados para fonts/ ao rodar os scripts (ver README).
// Space Grotesk vem em arquivo estatico (Medium, 500): com a fonte variavel o resvg ignora o peso e
// desenha a versao fina.
const path = require("path");

const FONTS = {
  HEADLINE: "Titan One",
  PUNCHLINE: "Pacifico",
  // Nome de familia gravado no arquivo SpaceGrotesk-Medium.ttf (veio do pacote @fontsource)
  TEXT: "Space Grotesk Light Medium",
  MEME: "Bangers",
};

const FONT_FILES = [
  "SpaceGrotesk-Medium.ttf",
  "TitanOne-Regular.ttf",
  "Pacifico-Regular.ttf",
  "Bangers-Regular.ttf",
].map((file) => path.join(__dirname, "fonts", file));

module.exports = { FONTS, FONT_FILES };
