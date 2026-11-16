// Bloco de texto das estampas de frase: linhas grandes (lines) e, embaixo, a linha de apoio (small).
//
// Tipografia da marca (fonts.js): a frase principal em Titan One, maiuscula, e a linha de apoio,
// que fecha a piada, em Pacifico, cursiva e minuscula (o catalogo guarda tudo em maiusculas e a
// conversao e feita aqui). A linha de apoio tem 75% da altura das linhas grandes (Pacifico tem
// letras baixas) e, quando e mais larga que a maior linha grande, quebra em mais linhas para nao
// obrigar a estampa a diminuir.
//
// Usado por render.js, mockup.js e model-mockup.js.
const { FONTS } = require("./fonts");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const SIZE = 200;
const SMALL = SIZE * 0.75;
// Linhas grandes um pouco mais juntas: Titan One tem acentos altos e o bloco fica compacto
const LINE = SIZE * 1.05;

/** Linha de apoio em minusculas (Pacifico em maiusculas fica ilegivel). */
const punchline = (text) => text.toLocaleLowerCase("pt-BR");

const mainText = (line, y, fill) =>
  `<text x="0" y="${y}" text-anchor="middle" font-family="${FONTS.HEADLINE}" font-size="${SIZE}" fill="${fill}">${esc(line)}</text>`;
const smallText = (line, y, fill) =>
  `<text x="0" y="${y}" text-anchor="middle" font-family="${FONTS.PUNCHLINE}" font-size="${SMALL}" fill="${fill}">${esc(line)}</text>`;

/** Quebra o texto de apoio em linhas que cabem em maxWidth (uma palavra sozinha nunca e cortada). */
function wrapSmall(text, maxWidth, width) {
  const rows = [];
  let row = "";
  for (const word of text.split(/\s+/)) {
    const next = row ? `${row} ${word}` : word;
    if (row && width(next) > maxWidth) {
      rows.push(row);
      row = word;
    } else {
      row = next;
    }
  }
  if (row) rows.push(row);
  return rows;
}

/**
 * SVG do bloco, centrado em x=0. `fill` e a cor da tinta e `measure(inner)` devolve o bbox
 * ({ width }) de um trecho de SVG, para medir as linhas com a fonte real.
 */
function textBlock(p, fill, measure) {
  const lines = p.lines.map((line) => line.trim());
  let y = SIZE - LINE;
  let out = "";
  for (const line of lines) {
    y += LINE;
    out += mainText(line, y, fill);
  }
  if (p.small) {
    const mainWidth = Math.max(...lines.map((line) => measure(mainText(line, SIZE, fill)).width));
    const rows = wrapSmall(punchline(p.small), mainWidth, (text) => measure(smallText(text, SIZE, fill)).width);
    y += SMALL * 0.25;
    for (const row of rows) {
      y += SMALL * 1.15;
      out += smallText(row, y, fill);
    }
  }
  return out;
}

module.exports = { textBlock, punchline };
