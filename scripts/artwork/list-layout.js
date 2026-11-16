// Layout "list": estampa com titulo e varias frases numeradas (ex.: "As 13 melhores frases").
//
// Tudo alinhado a esquerda: titulo grande, subtitulo, e frases numeradas.
// fitList testa varias larguras de quebra de linha e fica com a que deixa a letra MAIOR dentro
// da area (frases muito largas ou muito altas diminuem tudo), para a lista caber e continuar legivel.
//
// Usado por render.js (arte de impressao), mockup.js e model-mockup.js (fotos do site).

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const TITLE = 140;
const SUBTITLE = 58;
const BODY = 64;
const NUMBER_COLUMN = 140;
const LINE = BODY * 1.22;
const ITEM_GAP = BODY * 0.42;

/** Quebra o texto em linhas de ate `max` caracteres, sem cortar palavras. */
function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Bloco SVG (coordenadas livres) com as frases quebradas em `wrapChars` caracteres. */
function listBlock(p, { ink, accent }, wrapChars) {
  let y = TITLE;
  let out = "";
  for (const line of p.lines) {
    out += `<text x="0" y="${y}" font-family="Archivo Black" font-size="${TITLE}" letter-spacing="-3" fill="${ink}">${esc(line)}</text>`;
    y += TITLE;
  }
  y -= TITLE; // y volta para a linha de base do ultimo titulo
  if (p.small) {
    y += SUBTITLE * 1.7;
    out += `<text x="0" y="${y}" font-family="Space Grotesk" font-weight="700" font-size="${SUBTITLE}" letter-spacing="4" fill="${ink}">${esc(p.small)}</text>`;
  }
  y += BODY * 1.6;
  p.items.forEach((item, i) => {
    const number = String(i + 1).padStart(2, "0");
    out += `<text x="0" y="${y}" font-family="Archivo Black" font-size="${BODY}" fill="${accent}">${number}</text>`;
    const lines = wrap(`“${item}”`, wrapChars);
    lines.forEach((line, j) => {
      out += `<text x="${NUMBER_COLUMN}" y="${y + j * LINE}" font-family="Space Grotesk" font-weight="500" font-size="${BODY}" fill="${ink}">${esc(line)}</text>`;
    });
    y += lines.length * LINE + ITEM_GAP;
  });
  return out;
}

/**
 * Melhor bloco para a area [w, h]: testa quebras de 24 a 72 caracteres e devolve a que
 * permite a maior escala. `measure(inner)` devolve o bbox { width, height } do bloco.
 */
function fitList(p, colors, [, , w, h], measure) {
  let best = null;
  for (let chars = 24; chars <= 72; chars += 2) {
    const inner = listBlock(p, colors, chars);
    const b = measure(inner);
    const scale = Math.min(w / b.width, h / b.height);
    if (!best || scale > best.scale) best = { inner, scale, chars };
  }
  return best;
}

module.exports = { fitList };
