// Gera as fotos do site (frontend/public/products) de moletons, camisetas oversized, canecas e garrafas.
//
// Parte das fotos-base em bases/ (pecas do fornecedor, fundo branco, 1000x1000, sem estampa) e aplica
// a estampa de cada produto do catalog.json com a mesma tipografia das artes. Em tecido a tinta
// acompanha dobras e sombras (fabric-blend.js).
//
// Cada entrada do catalog.json gera todas as versoes vendidas daquela estampa:
//   camiseta-<frase> -> oversized-<frase>.png
//   moletom-<frase>  -> moletom-<frase>-<cor>.png e moletom-gola-careca-<frase>-<cor>.png
//   caneca-<frase>   -> caneca-<frase>-<modelo>.png
//   garrafa-<frase>  -> garrafa-<frase>-<modelo>.png
// As camisetas comuns usam fotos com modelo: ver model-mockup.js.
//
// Uso: node mockup.js <pasta de saida> [slug...]
//   Sem slugs: gera para todos os produtos do catalog.json. Saida em PNG; converta para JPG (ver README).
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { FONTS, FONT_FILES } = require("./fonts");
const { PNG } = require("pngjs");
const { fitList } = require("./list-layout");
const { textBlock: textBlockSvg, textAspect } = require("./text-block");
const { imageBlock } = require("./image-layout");
const { blendPrint } = require("./fabric-blend");
const { wrapCylinder } = require("./cylinder");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const outDir = process.argv[2];
const only = new Set(process.argv.slice(3));
fs.mkdirSync(outDir, { recursive: true });

const INK = { dark: "#141414", light: "#F5F5F0" };
// Cor dos numeros da estampa-lista (list-layout.js)
const ACCENT = { dark: "#141414", light: "#D9FF3F" };
const SIZE = 1000;

/**
 * Versoes de cada tipo. Coordenadas na foto-base 1000x1000:
 * - name: nome do arquivo de saida a partir da frase (slug sem o tipo);
 * - base: foto em bases/; ink: tinta clara em peca escura e escura em peca clara;
 * - art: retangulo onde a frase e encaixada; maxScale limita o tamanho da letra;
 * - listArt: area mais alta, usada pela estampa-lista e pela estampa desenhada;
 * - skip: layouts que nao sao gerados nessa peca (a estampa nao cabe bem).
 */
const garment = (prefix, base, colors, shape) =>
  colors.map(([color, ink]) => ({ name: (k) => `${prefix}-${k}-${color}`, base: `${base}-${color}.png`, ink, ...shape }));

const VARIANTS = {
  camiseta: [
    {
      name: (k) => `oversized-${k}`,
      base: "oversized-offwhite.png",
      ink: "dark",
      art: [335, 280, 330, 300],
      listArt: [315, 250, 370, 560],
      maxScale: 0.3,
    },
  ],
  moletom: [
    ...garment("moletom", "moletom-canguru", [["cinza", "dark"], ["preta", "light"], ["branca", "dark"]], {
      // Entre os cordoes do capuz e o bolso canguru
      art: [352, 452, 296, 190],
      maxScale: 0.22,
      // Area baixa demais para a estampa-lista e a estampa desenhada: essas nao saem no canguru
      skip: ["list", "image"],
    }),
    ...garment("moletom-gola-careca", "moletom-gola-careca", [["cinza", "dark"], ["preta", "light"], ["branca", "dark"]], {
      art: [345, 270, 310, 280],
      listArt: [325, 250, 350, 470],
      maxScale: 0.24,
    }),
  ],
  // Superficies cilindricas: a arte e montada aberta (art.x/art.w medidos ao longo da superficie,
  // centrados no eixo) e depois enrolada no cilindro (cylinder.js). cylinder: eixo cx, raio r
  // (metade da largura do corpo na foto) e tilt (altura / largura da elipse da boca).
  caneca: [
    { name: (k) => `caneca-${k}-branca`, base: "caneca-branca.png", ink: "dark", art: [0, 300, 360, 400], maxScale: 0.42, cylinder: { cx: 560, r: 235, tilt: 0.11 } },
    { name: (k) => `caneca-${k}-preta`, base: "caneca-preta.png", ink: "light", art: [0, 300, 360, 400], maxScale: 0.42, cylinder: { cx: 562, r: 240, tilt: 0.11 } },
    { name: (k) => `caneca-${k}-magica`, base: "caneca-magica.png", ink: "light", art: [0, 300, 350, 400], maxScale: 0.42, cylinder: { cx: 579, r: 229, tilt: 0.11 } },
    { name: (k) => `caneca-${k}-termica`, base: "caneca-termica.png", ink: "light", art: [0, 345, 350, 340], maxScale: 0.42, cylinder: { cx: 577, r: 232, tilt: 0.1 } },
    { name: (k) => `caneca-${k}-coracao`, base: "caneca-coracao.png", ink: "dark", art: [0, 300, 345, 400], maxScale: 0.42, cylinder: { cx: 420, r: 223, tilt: 0.11 } },
  ],
  garrafa: [
    { name: (k) => `garrafa-${k}-queta-preta`, base: "garrafa-queta-preta.png", ink: "light", art: [0, 480, 200, 300], maxScale: 0.2, cylinder: { cx: 524, r: 120, tilt: 0.08 } },
    { name: (k) => `garrafa-${k}-queta-branca`, base: "garrafa-queta-branca.png", ink: "dark", art: [0, 480, 200, 300], maxScale: 0.2, cylinder: { cx: 521, r: 120, tilt: 0.08 } },
    { name: (k) => `garrafa-${k}-queta-roxa`, base: "garrafa-queta-roxa.png", ink: "light", art: [0, 480, 200, 300], maxScale: 0.2, cylinder: { cx: 524, r: 120, tilt: 0.08 } },
    { name: (k) => `garrafa-${k}-queta-azul`, base: "garrafa-queta-azul.png", ink: "light", art: [0, 480, 200, 300], maxScale: 0.2, cylinder: { cx: 524, r: 120, tilt: 0.08 } },
    { name: (k) => `garrafa-${k}-norton`, base: "garrafa-norton.png", ink: "light", art: [0, 490, 190, 300], maxScale: 0.2, cylinder: { cx: 492, r: 121, tilt: 0.08 } },
  ],
};


/** Frase da estampa na cor da tinta (text-block.js). */
const textBlock = (p, ink, aspect) => textBlockSvg(p, INK[ink], bbox, aspect);

const render = (svg) =>
  new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONTS.HEADLINE } });

function bbox(inner) {
  const W = 6000;
  const b = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}"><g transform="translate(${W / 2},500)">${inner}</g></svg>`).getBBox();
  return { x: b.x - W / 2, y: b.y - 500, width: b.width, height: b.height };
}

function placeBlock(inner, [ax, ay, aw, ah], maxScale) {
  const b = bbox(inner);
  // Frases curtas nao devem virar letreiro: limita o tamanho da letra
  const s = Math.min(aw / b.width, ah / b.height, maxScale);
  const tx = ax + aw / 2 - (b.x + b.width / 2) * s;
  const ty = ay + ah / 2 - (b.y + b.height / 2) * s;
  return `<g transform="translate(${tx},${ty}) scale(${s})">${inner}</g>`;
}

/** Foto-base (RGBA), decodificada uma vez por arquivo. */
const baseCache = new Map();
function basePixels(file) {
  if (!baseCache.has(file)) {
    const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, "bases", file)));
    if (png.width !== SIZE || png.height !== SIZE) throw new Error(`${file}: a foto-base precisa ter ${SIZE}x${SIZE}`);
    baseCache.set(file, png.data);
  }
  return baseCache.get(file);
}

/**
 * Caneca com a lista lado a lado (listSide): a estampa da a volta na caneca, entao a foto so mostra
 * a parte da frente. A arte aberta tem a largura de verdade (fracao da circunferencia) e e girada
 * para o titulo e o comeco das frases ficarem de frente para a camera.
 */
function sideListArt(p, v) {
  const t = catalog.types[p.type];
  const [fw, fh] = Object.values(t.files)[0];
  const { cx, r } = v.cylinder;
  const aw = 2 * Math.PI * r * t.listArea[2];
  const ah = (aw * (t.listArea[3] * fh)) / (t.listArea[2] * fw);
  const inner = fitList(p, { ink: INK[v.ink], accent: ACCENT[v.ink] }, [0, 0, aw, ah], bbox, { side: true }).inner;
  const b = bbox(inner);
  const s = Math.min(aw / b.width, ah / b.height);
  // Borda esquerda da arte um pouco antes da lateral visivel da caneca
  const left = cx - SIDE_LIST_START * Math.PI * r;
  const top = v.art[1] + v.art[3] / 2 - ah / 2;
  const tx = left - b.x * s;
  const ty = top + ah / 2 - (b.y + b.height / 2) * s;
  return { art: `<g transform="translate(${tx},${ty}) scale(${s})">${inner}</g>`, area: [left, top, aw, ah] };
}
// Onde a arte comeca na foto, em fracao de pi*r a esquerda do eixo (0,5 = lateral da caneca)
const SIDE_LIST_START = 0.28;

function mockup(p, v) {
  const tall = (p.layout === "list" || p.layout === "image") && v.listArt;
  const cyl = v.cylinder;
  let area = tall ? v.listArt : v.art;
  let sideArt;
  // No cilindro a arte aberta fica centrada no eixo
  if (cyl) area = [cyl.cx - area[2] / 2, area[1], area[2], area[3]];
  const side = p.layout === "list" && cyl && catalog.types[p.type].listSide;
  if (side) ({ art: sideArt, area } = sideListArt(p, v));
  const art = side
    ? sideArt
    : p.layout === "list" && v.listArt
      ? placeBlock(fitList(p, { ink: INK[v.ink], accent: ACCENT[v.ink] }, area, bbox).inner, area, Infinity)
      : p.layout === "image"
        ? placeBlock(imageBlock(p, INK[v.ink], bbox), area, Infinity)
        : placeBlock(textBlock(p, v.ink, textAspect(catalog, p)), area, v.maxScale);
  // Estampa sozinha (fundo transparente), aplicada na peca acompanhando dobras e sombras
  let overlay = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${art}</svg>`).render().pixels;
  let region = area;
  if (cyl) {
    overlay = wrapCylinder(overlay, SIZE, SIZE, cyl);
    // Enrolada, a estampa ocupa a largura do corpo e sobe um pouco nas bordas
    const lift = Math.ceil(cyl.tilt * cyl.r);
    region = [cyl.cx - cyl.r, area[1] - lift, 2 * cyl.r, area[3] + lift];
  }
  const pixels = Buffer.from(basePixels(v.base));
  blendPrint(pixels, overlay, SIZE, SIZE, region, v.ink === "dark" ? "light" : "dark", { rigid: Boolean(cyl) });
  const png = new PNG({ width: SIZE, height: SIZE });
  pixels.copy(png.data);
  return PNG.sync.write(png);
}

let count = 0;
for (const p of catalog.products) {
  const variants = VARIANTS[p.type];
  if (!variants || (only.size && !only.has(p.slug))) continue;
  const key = p.slug.slice(p.type.length + 1);
  for (const v of variants) {
    if (v.skip?.includes(p.layout)) continue;
    fs.writeFileSync(path.join(outDir, `${v.name(key)}.png`), mockup(p, v));
    count++;
  }
}
console.log(`${count} mockups gerados em ${outDir}`);
