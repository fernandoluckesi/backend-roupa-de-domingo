// Layout "image": estampa desenhada (arquivo PNG em scripts/artwork/images), em vez de frase.
//
// O desenho e tratado como arte de uma cor so, igual as frases: o fundo branco vira transparente
// e o traco recebe a cor da tinta (escura em peca clara, clara em peca escura). Quanto mais
// escuro o ponto do desenho, mais tinta; os cinzas viram tinta mais fraca.
//
// Usado por render.js (arte de impressao), mockup.js e model-mockup.js (fotos do site).
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const WIDTH = 1000; // largura do bloco em coordenadas livres (depois e escalado para a area)
const WHITE = 238; // a partir daqui e fundo (transparente)
const BLACK = 40; // daqui para baixo e tinta cheia

const cache = new Map();

/** PNG (base64) do desenho na cor da tinta, com o fundo transparente. */
function inked(file, color) {
  const key = `${file}|${color}`;
  if (cache.has(key)) return cache.get(key);
  const src = PNG.sync.read(fs.readFileSync(path.join(__dirname, "images", file)));
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

/** Bloco SVG com o desenho centrado em x=0, como o textBlock das frases. `ink` e a cor (#rrggbb). */
function imageBlock(p, ink) {
  const { b64, width, height } = inked(p.image, ink);
  const h = (WIDTH * height) / width;
  return `<image x="${-WIDTH / 2}" y="0" width="${WIDTH}" height="${h}" href="data:image/png;base64,${b64}"/>`;
}

module.exports = { imageBlock };
