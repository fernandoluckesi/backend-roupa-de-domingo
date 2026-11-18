// Layout "list": estampa com titulo e varias frases numeradas (ex.: "As 13 melhores frases").
//
// Tudo alinhado a esquerda: titulo grande, subtitulo, e frases numeradas.
// fitList testa varias larguras de quebra de linha e fica com a que deixa a letra MAIOR dentro
// da area (frases muito largas ou muito altas diminuem tudo), para a lista caber e continuar legivel.
//
// Caneca (`side`): a estampa da a volta na caneca, entao sobra largura e falta altura. O titulo
// vira uma coluna a esquerda, centrada na altura da lista, e cada frase fica numa linha so, sem
// quebra (listSideBlock). Assim a letra fica bem maior que na lista empilhada.
//
// Usado por render.js (arte de impressao), mockup.js e model-mockup.js (fotos do site).

const { FONTS } = require("./fonts");
const { signature, withSignature } = require("./signature");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const TITLE = 140;
const SUBTITLE = 126;
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
function listBlock(p, { ink, accent }, wrapChars, measure) {
  let y = TITLE;
  let out = "";
  for (const line of p.lines) {
    out += `<text x="0" y="${y}" font-family="${FONTS.HEADLINE}" font-size="${TITLE}" fill="${ink}">${esc(line)}</text>`;
    y += TITLE;
  }
  y -= TITLE; // y volta para a linha de base do ultimo titulo
  if (p.small) {
    y += SUBTITLE * 1.7;
    out += `<text x="0" y="${y}" font-family="${FONTS.PUNCHLINE}" font-size="${SUBTITLE}" fill="${ink}">${esc(punchline(p.small))}</text>`;
  }
  y += BODY * 1.6;
  p.items.forEach((item, i) => {
    const number = String(i + 1).padStart(2, "0");
    out += `<text x="0" y="${y}" font-family="${FONTS.HEADLINE}" font-size="${BODY}" fill="${accent}">${number}</text>`;
    const lines = wrap(`“${item}”`, wrapChars);
    lines.forEach((line, j) => {
      out += `<text x="${NUMBER_COLUMN}" y="${y + j * LINE}" font-family="${FONTS.TEXT}" font-size="${BODY}" fill="${ink}">${esc(line)}</text>`;
    });
    y += lines.length * LINE + ITEM_GAP;
  });
  // Assinatura da marca no pe da lista, alinhada a esquerda como o resto
  return withSignature(out, ink, measure, { anchor: "start", min: 420, max: 520, gap: 70 });
}

// Espaco entre a coluna do titulo e a lista, na versao lado a lado
const SIDE_GAP = 160;

/** Lista lado a lado (caneca): titulo numa coluna a esquerda e cada frase numa linha so. */
function listSideBlock(p, { ink, accent }, measure) {
  let title = "";
  let y = TITLE;
  for (const line of p.lines) {
    title += `<text x="0" y="${y}" font-family="${FONTS.HEADLINE}" font-size="${TITLE}" fill="${ink}">${esc(line)}</text>`;
    y += TITLE;
  }
  y -= TITLE;
  if (p.small) {
    y += SUBTITLE * 1.4;
    title += `<text x="0" y="${y}" font-family="${FONTS.PUNCHLINE}" font-size="${SUBTITLE}" fill="${ink}">${esc(punchline(p.small))}</text>`;
  }
  // Assinatura da marca embaixo do titulo, na coluna da esquerda
  const head = measure(title);
  title += signature(ink, measure, { x: head.x, y: head.y + head.height + 90, width: Math.min(head.width, 520), anchor: "start" });
  const titleBox = measure(title);
  const x = titleBox.width + SIDE_GAP;

  let list = "";
  let ly = BODY;
  p.items.forEach((item, i) => {
    const number = String(i + 1).padStart(2, "0");
    list += `<text x="${x}" y="${ly}" font-family="${FONTS.HEADLINE}" font-size="${BODY}" fill="${accent}">${number}</text>`;
    list += `<text x="${x + NUMBER_COLUMN}" y="${ly}" font-family="${FONTS.TEXT}" font-size="${BODY}" fill="${ink}">${esc(`“${item}”`)}</text>`;
    ly += LINE + ITEM_GAP;
  });
  const listBox = measure(list);
  // Coluna do titulo centrada na altura da lista
  const dy = listBox.y + listBox.height / 2 - (titleBox.y + titleBox.height / 2);
  return `<g transform="translate(0,${dy})">${title}</g>${list}`;
}

/**
 * Melhor bloco para a area [w, h]: testa quebras de 24 a 72 caracteres e devolve a que
 * permite a maior escala (com `side`, monta a lista lado a lado). `measure(inner)` devolve o bbox { width, height } do bloco.
 */
function fitList(p, colors, [, , w, h], measure, { side = false } = {}) {
  if (side) {
    const inner = listSideBlock(p, colors, measure);
    const b = measure(inner);
    return { inner, scale: Math.min(w / b.width, h / b.height) };
  }
  let best = null;
  for (let chars = 24; chars <= 72; chars += 2) {
    const inner = listBlock(p, colors, chars, measure);
    const b = measure(inner);
    const scale = Math.min(w / b.width, h / b.height);
    if (!best || scale > best.scale) best = { inner, scale, chars };
  }
  return best;
}

const { punchline } = require("./text-block");

module.exports = { fitList };
