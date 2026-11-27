// Gera as artes (PNG transparente) de cada produto a partir de catalog.json.
// Uso: node render.js <pasta de saida>
// A composicao (artSvg) tambem e usada por print-arts.js, que exporta as artes de impressao.
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { FONTS, FONT_FILES } = require("./fonts");
const { fitList } = require("./list-layout");
const { textBlock: textBlockSvg, textAspect } = require("./text-block");
const { imageBlock } = require("./image-layout");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));

const INK = { dark: "#141414", light: "#F5F5F0" };
// Cor dos numeros da estampa-lista (list-layout.js)
const ACCENT = { dark: "#141414", light: "#D9FF3F" };


/** Frase da estampa na cor da tinta (text-block.js). */
const textBlock = (p, ink, aspect) => textBlockSvg(p, INK[ink], bbox, aspect);

function render(svg) {
  return new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONTS.HEADLINE },
  });
}

function bbox(inner, w, h) {
  // Mede o bloco centrado em (w/2, 0) numa tela grande
  const W = 6000, H = 6000;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="translate(${W / 2},500)">${inner}</g></svg>`;
  const b = render(svg).getBBox();
  return { x: b.x - W / 2, y: b.y - 500, width: b.width, height: b.height };
}

function placeBlock(inner, area) {
  const [ax, ay, aw, ah] = area;
  const b = bbox(inner);
  const s = Math.min(aw / b.width, ah / b.height);
  const cx = ax + aw / 2, cy = ay + ah / 2;
  const tx = cx - (b.x + b.width / 2) * s;
  const ty = cy - (b.y + b.height / 2) * s;
  return `<g transform="translate(${tx},${ty}) scale(${s})">${inner}</g>`;
}

/**
 * SVG da arte de um produto (catalog.json) para uma tinta ("dark" ou "light") e um arquivo do tipo
 * (ex.: "front"). `scale` aumenta a resolucao sem mudar a composicao: a arte e vetorial.
 */
function artSvg(p, ink, fileKey, scale = 1) {
  const t = catalog.types[p.type];
  const [w, h] = t.files[fileKey];
  // Estampa-lista: area propria do tipo (listArea) e quebra de linha escolhida para caber
  const isList = p.layout === "list";
  const isImage = p.layout === "image";
  const a = ((isList || isImage) && t.listArea) || t.area;
  // Caneca com lista: uma estampa so dando a volta na caneca (lista lado a lado)
  const side = isList && Boolean(t.listSide);
  const inner = isList
    ? fitList(p, { ink: INK[ink], accent: ACCENT[ink] }, [0, 0, a[2] * w, a[3] * h], bbox, { side }).inner
    : isImage
      ? imageBlock(p, INK[ink], bbox)
      : textBlock(p, ink, textAspect(catalog, p));
  let body;
  if (t.wrap && !side) {
    // Caneca: a frase aparece dos dois lados (destro e canhoto)
    const left = [a[0] * w, a[1] * h, a[2] * w, a[3] * h];
    const right = [w - (a[0] + a[2]) * w, a[1] * h, a[2] * w, a[3] * h];
    body = placeBlock(inner, left) + placeBlock(inner, right);
  } else {
    body = placeBlock(inner, [a[0] * w, a[1] * h, a[2] * w, a[3] * h]);
  }
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

module.exports = { catalog, artSvg, render };

if (require.main === module) {
  const outDir = process.argv[2];
  fs.mkdirSync(outDir, { recursive: true });
  let count = 0;
  for (const p of catalog.products) {
    const t = catalog.types[p.type];
    for (const ink of t.inks) {
      for (const fileKey of Object.keys(t.files)) {
        const png = render(artSvg(p, ink, fileKey)).render().asPng();
        fs.writeFileSync(path.join(outDir, `${p.slug}--${fileKey}--${ink}.png`), png);
        count++;
      }
    }
  }
  console.log(`${count} artes geradas em ${outDir}`);
}
