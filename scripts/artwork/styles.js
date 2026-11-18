// Estilos tipograficos das estampas de frase (campo "style" no catalog.json). Cada frase escolhe o
// seu, para a colecao nao ficar com cara de modelo unico. O estilo "classic" (Londrina Solid +
// Lobster Two) fica em text-block.js; aqui ficam os outros:
//
// - poster: Anton condensada, maiuscula. Cada linha cresce ou diminui ate ter a mesma largura das
//   outras (bloco justificado, como cartaz); a linha de apoio vai embaixo, pequena, em Space
//   Grotesk espacada, na cor de destaque.
// - stack: Kanit Black em minusculas, linhas coladas; a linha de apoio fecha a piada no mesmo
//   tamanho, em italico e na cor de destaque.
// - marker: Permanent Marker (pincel atomico), maiuscula, com o bloco levemente inclinado; a linha
//   de apoio vai menor, no mesmo pincel.
//
// Cor de destaque: verde-limao da logo em peca escura, a propria tinta em peca clara (signature.js).
// Todos devolvem o bloco centrado em x=0, como o classic.
const { FONTS } = require("./fonts");
const { accentFor } = require("./signature");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const lower = (t) => t.toLocaleLowerCase("pt-BR");

const SIZE = 200;

/** Quebra o texto em linhas que cabem em maxWidth (uma palavra sozinha nunca e cortada). */
function wrap(text, maxWidth, width) {
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

const text = (t, { y, font, size, fill, italic = false, weight = 0, spacing = 0, anchor = "middle" }) =>
  `<text x="0" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size}"` +
  `${weight ? ` font-weight="${weight}"` : ""}${italic ? ' font-style="italic"' : ""}` +
  `${spacing ? ` letter-spacing="${spacing}"` : ""} fill="${fill}">${esc(t)}</text>`;

/**
 * Quebra da linha de apoio que deixa o bloco maior na proporcao `aspect` (largura / altura da
 * estampa): testa larguras entre `minWidth` e a linha inteira. `build(rows)` monta o bloco.
 */
function bestRows(small, width, minWidth, aspect, build, measure) {
  const full = Math.max(minWidth, width(small));
  let best = null;
  const seen = new Set();
  for (let i = 0; i <= 10; i++) {
    const rows = wrap(small, minWidth + ((full - minWidth) * i) / 10, width);
    const key = rows.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const svg = build(rows);
    const b = measure(svg);
    const scale = aspect ? Math.min(aspect / b.width, 1 / b.height) : -rows.length;
    if (!best || scale > best.scale) best = { svg, scale };
  }
  return best.svg;
}

// ------------------------------------------------------------------ poster
// Linhas curtas nao crescem mais que isto (uma palavra de 2 letras viraria um outdoor)
const POSTER_MAX_GROW = 2.2;

function poster(p, fill, measure) {
  const lines = p.lines.map((l) => l.trim());
  const widthAt = (t) => measure(text(t, { y: SIZE, font: FONTS.POSTER, size: SIZE, fill })).width;
  const widths = lines.map(widthAt);
  const target = Math.max(...widths);
  let out = "";
  let y = 0;
  lines.forEach((line, i) => {
    const size = SIZE * Math.min(POSTER_MAX_GROW, target / widths[i]);
    // Anton tem maiusculas altas e quase sem descendente: entrelinha bem fechada
    y += size * (i === 0 ? 0.86 : 0.98);
    out += text(line, { y, font: FONTS.POSTER, size, fill });
  });
  if (p.small) {
    const size = SIZE * 0.3;
    const spacing = size * 0.12;
    const width = (t) => measure(text(t, { y: 0, font: FONTS.TEXT, size, fill, spacing })).width;
    const rows = wrap(p.small, target * 0.95, width);
    y += size * 0.9;
    for (const row of rows) {
      y += size * 1.25;
      out += text(row, { y, font: FONTS.TEXT, size, fill: accentFor(fill), spacing });
    }
  }
  return out;
}

// ------------------------------------------------------------------ stack
function stack(p, fill, measure, aspect) {
  const lines = p.lines.map((l) => lower(l.trim()));
  const LINE = SIZE * 1.0;
  const main = { font: FONTS.STACK, size: SIZE, weight: 900, fill };
  const build = (rows) => {
    let out = "";
    let y = 0;
    for (const line of lines) out += text(line, { ...main, y: (y += LINE) });
    for (const row of rows) out += text(row, { ...main, y: (y += LINE), italic: true, fill: accentFor(fill) });
    return out;
  };
  if (!p.small) return build([]);
  const width = (t) => measure(text(t, { ...main, y: 0, italic: true })).width;
  const mainWidth = Math.max(...lines.map((l) => measure(text(l, { ...main, y: 0 })).width));
  return bestRows(lower(p.small), width, mainWidth, aspect, build, measure);
}

// ------------------------------------------------------------------ marker
const MARKER_TILT = -4;

function marker(p, fill, measure, aspect) {
  const lines = p.lines.map((l) => l.trim());
  const size = SIZE * 0.62;
  const build = (rows) => {
    let out = "";
    let y = 0;
    for (const line of lines) out += text(line, { y: (y += SIZE * 1.12), font: FONTS.MARKER, size: SIZE, fill });
    if (rows.length) y += size * 0.35;
    for (const row of rows) out += text(row, { y: (y += size * 1.15), font: FONTS.MARKER, size, fill: accentFor(fill) });
    return out;
  };
  let out = build([]);
  if (p.small) {
    const mainWidth = Math.max(...lines.map((l) => measure(text(l, { y: 0, font: FONTS.MARKER, size: SIZE, fill })).width));
    const width = (t) => measure(text(t, { y: 0, font: FONTS.MARKER, size, fill })).width;
    out = bestRows(p.small, width, mainWidth, aspect, build, measure);
  }
  const b = measure(out);
  return `<g transform="rotate(${MARKER_TILT} 0 ${b.y + b.height / 2})">${out}</g>`;
}

const STYLES = { poster, stack, marker };

module.exports = { STYLES };
