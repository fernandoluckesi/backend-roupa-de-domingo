// Bloco de texto das estampas de frase: linhas grandes (lines) e, embaixo, a linha de apoio (small).
//
// Tipografia da marca (fonts.js): a frase principal em Londrina Solid, maiuscula, e a linha de apoio,
// que fecha a piada, em Lobster Two, cursiva e minuscula (o catalogo guarda tudo em maiusculas e a
// conversao e feita aqui). A linha de apoio tem 105% da altura das linhas grandes (a cursiva tem
// letras baixas). As duas mantem sempre essa proporcao: frase longa diminui o bloco inteiro.
//
// Quebra de linha: com `aspect` (largura / altura da estampa, ver textAspect), o script testa
// varias quebras e fica com a que deixa o bloco MAIOR nessa proporcao:
// - a linha de apoio pode ficar mais larga que a frase principal (senao vira uma coluna de palavras
//   soltas, o bloco fica alto e a frase principal encolhe);
// - a frase principal mantem as linhas do catalog.json, a nao ser que outra quebra deixe a letra
//   pelo menos KEEP_LINES_BONUS maior (frases longas em linhas curtas ficavam miudas).
// Todos os scripts usam a mesma proporcao, entao a foto do site mostra exatamente a mesma quebra
// da arte impressa.
//
// Usado por render.js, mockup.js e model-mockup.js.
const { FONTS } = require("./fonts");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const SIZE = 200;
const SMALL = SIZE * 1.05;
// Espaco entre as linhas grandes: folga para os acentos das maiusculas
const LINE = SIZE * 1.12;
// Larguras de quebra testadas (entre a palavra mais larga e uma linha so)
const WRAP_STEPS = 12;
// Outra quebra da frase principal so vale se deixar a letra 12% maior que as linhas do catalogo
const KEEP_LINES_BONUS = 1.12;

/** Linha de apoio em minusculas (cursiva em maiusculas fica ilegivel). */
const punchline = (text) => text.toLocaleLowerCase("pt-BR");

const mainText = (line, y, fill) =>
  `<text x="0" y="${y}" text-anchor="middle" font-family="${FONTS.HEADLINE}" font-size="${SIZE}" fill="${fill}">${esc(line)}</text>`;
const smallText = (line, y, fill) =>
  `<text x="0" y="${y}" text-anchor="middle" font-family="${FONTS.PUNCHLINE}" font-size="${SMALL}" fill="${fill}">${esc(line)}</text>`;

/**
 * Proporcao (largura / altura) usada para escolher a quebra de linha: `textAspect` do tipo no
 * catalog.json (proporcao da estampa nas fotos do site, mais estreita que a area de impressao) ou,
 * sem ele, a propria area de impressao. Arte impressa e fotos usam o mesmo valor, entao a quebra
 * de linha e a mesma nas duas.
 */
function textAspect(catalog, p) {
  const t = catalog.types[p.type];
  if (t.textAspect) return t.textAspect;
  const [w, h] = Object.values(t.files)[0];
  return (t.area[2] * w) / (t.area[3] * h);
}

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

/** Quebras diferentes do texto, da mais estreita (palavra mais larga) ate uma linha so. */
function wraps(text, width, minWidth) {
  const words = text.split(/\s+/);
  const from = Math.max(minWidth, ...words.map(width));
  const to = Math.max(from, width(text));
  const out = new Map();
  for (let i = 0; i <= WRAP_STEPS; i++) {
    const rows = wrap(text, from + ((to - from) * i) / WRAP_STEPS, width);
    out.set(rows.join("\n"), rows);
  }
  return [...out.values()];
}

/** SVG das linhas grandes seguidas das linhas de apoio ja quebradas. */
function blockSvg(lines, rows, fill) {
  let y = SIZE - LINE;
  let out = "";
  for (const line of lines) {
    y += LINE;
    out += mainText(line, y, fill);
  }
  if (rows.length) y += SMALL * 0.25;
  for (const row of rows) {
    y += SMALL * 1.15;
    out += smallText(row, y, fill);
  }
  return out;
}

/**
 * SVG do bloco, centrado em x=0. `fill` e a cor da tinta e `measure(inner)` devolve o bbox
 * ({ width, height }) de um trecho de SVG, para medir as linhas com a fonte real. `aspect` e a
 * proporcao (largura / altura) da estampa (textAspect).
 */
function textBlock(p, fill, measure, aspect) {
  const lines = p.lines.map((line) => line.trim());
  const text = p.small ? punchline(p.small) : "";
  if (!aspect) {
    if (!text) return blockSvg(lines, [], fill);
    const mainWidth = Math.max(...lines.map((line) => measure(mainText(line, SIZE, fill)).width));
    return blockSvg(lines, wrap(text, mainWidth, (t) => measure(smallText(t, SIZE, fill)).width), fill);
  }

  // Medidas com cache: cada texto e medido uma vez
  const cache = new Map();
  const cached = (key, fn) => (cache.has(key) ? cache.get(key) : cache.set(key, fn()).get(key));
  const mainWidth = (t) => cached(`m${t}`, () => measure(mainText(t, SIZE, fill)).width);
  const smallWidth = (t) => cached(`s${t}`, () => measure(smallText(t, SIZE, fill)).width);
  // A altura depende so do numero de linhas de cada estilo
  const height = (n, r) =>
    cached(`h${n},${r}`, () => measure(blockSvg(Array(n).fill("ÁÉÍ"), Array(r).fill("ágjp"), fill)).height);

  // Melhor quebra da linha de apoio para uma frase principal, e a escala na area (altura 1)
  const fit = (main) => {
    const width = Math.max(...main.map(mainWidth));
    let best = null;
    for (const rows of text ? wraps(text, smallWidth, width) : [[]]) {
      const w = Math.max(width, ...rows.map(smallWidth));
      const scale = Math.min(aspect / w, 1 / height(main.length, rows.length));
      if (!best || scale > best.scale) best = { main, rows, scale };
    }
    return best;
  };

  const keep = fit(lines);
  let best = keep;
  for (const main of wraps(lines.join(" "), mainWidth, 0)) {
    const option = fit(main);
    if (option.scale > best.scale) best = option;
  }
  if (best.scale < keep.scale * KEEP_LINES_BONUS) best = keep;
  return blockSvg(best.main, best.rows, fill);
}

module.exports = { textBlock, punchline, textAspect };
