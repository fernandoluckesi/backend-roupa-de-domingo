// Gera as artes (PNG transparente) de cada produto a partir de catalog.json.
// Uso: node render.js <pasta de saida>
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { FONTS, FONT_FILES } = require("./fonts");
const { fitList } = require("./list-layout");
const { textBlock: textBlockSvg, textAspect } = require("./text-block");
const { imageBlock } = require("./image-layout");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

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

let count = 0;
for (const p of catalog.products) {
  const t = catalog.types[p.type];
  for (const ink of t.inks) {
    for (const [fileKey, [w, h]] of Object.entries(t.files)) {
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
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
      const png = render(svg).render().asPng();
      const name = `${p.slug}--${fileKey}--${ink}.png`;
      fs.writeFileSync(path.join(outDir, name), png);
      count++;
    }
  }
}
console.log(`${count} artes geradas em ${outDir}`);
