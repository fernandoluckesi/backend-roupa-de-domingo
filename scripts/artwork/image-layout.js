// Layout "image": estampa desenhada (arquivo PNG em scripts/artwork/images), em vez de frase.
//
// O desenho e tratado como arte de uma cor so, igual as frases: o fundo branco vira transparente
// e o traco recebe a cor da tinta (escura em peca clara, clara em peca escura). Quanto mais
// escuro o ponto do desenho, mais tinta; os cinzas viram tinta mais fraca.
//
// Legenda: memes com personagem usam sempre a fonte MEME (Bangers, ver fonts.js). Quando o desenho
// ja vem com o texto, `erase` lista os retangulos (em pixels do desenho) que sao apagados e
// `caption` escreve a legenda de novo, com a fonte padrao, dentro de `caption.box`.
//
// Usado por render.js (arte de impressao), mockup.js e model-mockup.js (fotos do site).
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { FONTS } = require("./fonts");
const { withSignature } = require("./signature");

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const WIDTH = 1000; // largura do bloco em coordenadas livres (depois e escalado para a area)
const WHITE = 238; // a partir daqui e fundo (transparente)
const BLACK = 40; // daqui para baixo e tinta cheia

const cache = new Map();

/** PNG (base64) do desenho na cor da tinta, com o fundo transparente. */
function inked(file, color, erase = []) {
  const key = `${file}|${color}|${JSON.stringify(erase)}`;
  if (cache.has(key)) return cache.get(key);
  const src = PNG.sync.read(fs.readFileSync(path.join(__dirname, "images", file)));
  // Apaga o texto que veio no desenho (vira fundo branco)
  for (const [ex, ey, ew, eh] of erase)
    for (let y = ey; y < ey + eh; y++)
      for (let x = ex; x < ex + ew; x++) src.data.fill(255, (y * src.width + x) * 4, (y * src.width + x) * 4 + 3);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const out = new PNG({ width: src.width, height: src.height });
  for (let i = 0; i < src.data.length; i += 4) {
    const lum = 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2];
    const ink = Math.max(0, Math.min(1, (WHITE - lum) / (WHITE - BLACK)));
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = Math.round(ink * (src.data[i + 3] / 255) * 255);
  }
  const result = { b64: PNG.sync.write(out).toString("base64"), width: src.width, height: src.height };
  cache.set(key, result);
  return result;
}

const CAPTION_SIZE = 100;

/** Legenda na fonte de meme, encaixada (e centrada) em caption.box, nas coordenadas do bloco. */
function captionBlock({ lines, box }, ink, k, measure) {
  const inner = lines
    .map((line, i) => `<text x="0" y="${(i + 1) * CAPTION_SIZE}" text-anchor="middle" font-family="${FONTS.MEME}" font-size="${CAPTION_SIZE}" fill="${ink}">${esc(line)}</text>`)
    .join("");
  const b = measure(inner);
  const [bx, by, bw, bh] = box.map((v) => v * k);
  const s = Math.min(bw / b.width, bh / b.height);
  const tx = -WIDTH / 2 + bx + bw / 2 - (b.x + b.width / 2) * s;
  const ty = by + bh / 2 - (b.y + b.height / 2) * s;
  return `<g transform="translate(${tx},${ty}) scale(${s})">${inner}</g>`;
}

/**
 * Bloco SVG com o desenho centrado em x=0, como o textBlock das frases. `ink` e a cor (#rrggbb) e
 * `measure(inner)` devolve o bbox de um trecho de SVG (para encaixar a legenda).
 */
function imageBlock(p, ink, measure) {
  const { b64, width, height } = inked(p.image, ink, p.erase);
  const k = WIDTH / width;
  const image = `<image x="${-WIDTH / 2}" y="0" width="${WIDTH}" height="${height * k}" href="data:image/png;base64,${b64}"/>`;
  const inner = image + (p.caption ? captionBlock(p.caption, ink, k, measure) : "");
  // Assinatura da marca embaixo do desenho
  return withSignature(inner, ink, measure, { min: 300, max: 360, gap: 50 });
}

module.exports = { imageBlock };
