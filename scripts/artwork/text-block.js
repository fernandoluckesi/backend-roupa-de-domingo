// Bloco de texto das estampas de frase: linhas grandes (lines) e, embaixo, a linha de apoio (small).
//
// A linha de apoio tem 60% da altura das linhas grandes (50% maior que os 40% originais, para ler
// melhor) e o mesmo peso em todas as saidas (arte de
// impressao e fotos do site). Quando ela e mais larga que a maior linha grande, quebra em mais
// linhas, para nao obrigar a estampa inteira a diminuir.
//
// Usado por render.js, mockup.js e model-mockup.js.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const SIZE = 200;
const SMALL = SIZE * 0.6;

const mainText = (line, y, fill) =>
  `<text x="0" y="${y}" text-anchor="middle" font-family="Archivo Black" font-size="${SIZE}" fill="${fill}" letter-spacing="-4">${esc(line)}</text>`;
const smallText = (line, y, fill) =>
  `<text x="0" y="${y}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${SMALL}" fill="${fill}">${esc(line)}</text>`;

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
  let y = 0;
  let out = "";
  for (const line of lines) {
    y += SIZE;
    out += mainText(line, y, fill);
  }
  if (p.small) {
    const mainWidth = Math.max(...lines.map((line) => measure(mainText(line, SIZE, fill)).width));
    const rows = wrapSmall(p.small, mainWidth, (text) => measure(smallText(text, SIZE, fill)).width);
    y += SMALL * 0.2;
    for (const row of rows) {
      y += SMALL;
      out += smallText(row, y, fill);
      y += SMALL * 0.08;
    }
  }
  return out;
}

module.exports = { textBlock };
