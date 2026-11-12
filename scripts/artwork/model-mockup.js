// Gera as fotos das camisetas com modelo (masculino e feminino), uma cor por foto.
//
// As fotos-base (frontend/src/assets/models) mostram o mesmo modelo duas vezes, lado a lado:
// camiseta branca a esquerda e preta a direita, com uma estampa de exemplo. Para cada camiseta
// do catalog.json o script:
// - apaga a estampa de exemplo (cada coluna e refeita interpolando a linha acima com a de baixo);
// - aplica a frase com a mesma tipografia das artes, no tamanho da estampa de exemplo;
// - separa cada metade numa foto quadrada 1000x1000 com fundo branco.
//
// Uso: node model-mockup.js <pasta models> <pasta de saida> [slug...]
// Saida: <slug>-<m|f>-<preta|branca>.png (converta para JPG, ver README).
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { PNG } = require("pngjs");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const [modelsDir, outDir, ...slugs] = process.argv.slice(2);
const only = new Set(slugs);
fs.mkdirSync(outDir, { recursive: true });

const FONT_FILES = [
  path.join(__dirname, "fonts", "ArchivoBlack-Regular.ttf"),
  path.join(__dirname, "fonts", "SpaceGrotesk-var.ttf"),
];
const INK = { dark: "#141414", light: "#F5F5F0" };
const ACCENT = { dark: "#141414", light: "#D9FF3F" };
const BACKGROUND = "#FEFEFE";
const OUT = 1000;

/**
 * Coordenadas na foto-base (1280x853):
 * - crop: inicio e largura da metade com aquela cor;
 * - erase: [x, y, w, h] que cobre a estampa de exemplo e a area da nova;
 * - art: retangulo onde a frase e centralizada;
 * - refWidth: largura da estampa de exemplo ("ESTOU BEM"), que define o tamanho maximo da letra.
 */
const MODELS = {
  m: {
    file: "male.jpeg",
    width: 1280,
    height: 853,
    shots: {
      branca: { crop: [0, 640], erase: [243, 370, 242, 202], art: [249, 376, 230, 190], refWidth: 178, ink: "dark" },
      preta: { crop: [640, 640], erase: [880, 369, 242, 202], art: [886, 375, 230, 190], refWidth: 174, ink: "light" },
    },
  },
  f: {
    file: "female.jpeg",
    width: 1280,
    height: 853,
    shots: {
      branca: { crop: [0, 640], erase: [259, 376, 242, 192], art: [265, 382, 230, 180], refWidth: 167, ink: "dark" },
      preta: { crop: [640, 640], erase: [829, 378, 242, 192], art: [835, 384, 230, 180], refWidth: 167, ink: "light" },
    },
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function textBlock(p, ink) {
  const size = 200;
  let y = size;
  let out = "";
  for (const line of p.lines) {
    out += `<text x="0" y="${y}" text-anchor="middle" font-family="Archivo Black" font-size="${size}" fill="${INK[ink]}" letter-spacing="-4">${esc(line.trim())}</text>`;
    y += size;
  }
  if (p.small) {
    y += size * 0.1;
    out += `<text x="0" y="${y}" text-anchor="middle" font-family="Space Grotesk" font-weight="400" font-size="${size * 0.4}" fill="${INK[ink]}">${esc(p.small)}</text>`;
    y += size * 0.4;
  }
  y += size * 0.5;
  out += `<text x="0" y="${y}" text-anchor="middle" font-family="Space Grotesk" font-weight="400" font-size="${size * 0.22}" letter-spacing="12" fill="${ACCENT[ink]}">ROUPA DE DOMINGO</text>`;
  return out;
}

const render = (svg) =>
  new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Archivo Black" } });

function bbox(inner) {
  const W = 8000;
  const b = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}"><g transform="translate(${W / 2},500)">${inner}</g></svg>`).getBBox();
  return { x: b.x - W / 2, y: b.y - 500, width: b.width, height: b.height };
}

// Escala da estampa de exemplo: frases curtas ficam do mesmo tamanho dela, longas diminuem
const reference = bbox(textBlock({ lines: ["ESTOU", "BEM"], small: "(MENTIRA)" }, "dark"));

function placeBlock(inner, shot) {
  const [ax, ay, aw, ah] = shot.art;
  const b = bbox(inner);
  const s = Math.min(aw / b.width, ah / b.height, shot.refWidth / reference.width);
  const tx = ax + aw / 2 - (b.x + b.width / 2) * s;
  const ty = ay + ah / 2 - (b.y + b.height / 2) * s;
  return `<g transform="translate(${tx},${ty}) scale(${s})">${inner}</g>`;
}

/** Foto-base sem as estampas de exemplo, em PNG base64. */
const cleanCache = new Map();
function cleanPhoto(model) {
  if (cleanCache.has(model.file)) return cleanCache.get(model.file);
  const { width: W, height: H } = model;
  const jpeg = fs.readFileSync(path.join(modelsDir, model.file)).toString("base64");
  const px = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><image href="data:image/jpeg;base64,${jpeg}" width="${W}" height="${H}"/></svg>`).render().pixels;
  const out = Buffer.from(px);
  for (const shot of Object.values(model.shots)) {
    const [ex, ey, ew, eh] = shot.erase;
    const top = ey - 1, bottom = ey + eh;
    for (let x = ex; x < ex + ew; x++) {
      for (let y = ey; y < bottom; y++) {
        const t = (y - top) / (bottom - top);
        for (let c = 0; c < 3; c++) {
          const v = px[(top * W + x) * 4 + c] * (1 - t) + px[(bottom * W + x) * 4 + c] * t;
          out[(y * W + x) * 4 + c] = Math.round(v);
        }
      }
    }
  }
  const png = new PNG({ width: W, height: H });
  out.copy(png.data);
  const b64 = PNG.sync.write(png).toString("base64");
  cleanCache.set(model.file, b64);
  return b64;
}

function photo(p, model, shot) {
  const [cx, cw] = shot.crop;
  const w = Math.round((OUT * cw) / model.height);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT}" height="${OUT}">
    <rect width="${OUT}" height="${OUT}" fill="${BACKGROUND}"/>
    <svg x="${(OUT - w) / 2}" y="0" width="${w}" height="${OUT}" viewBox="${cx} 0 ${cw} ${model.height}">
      <image href="data:image/png;base64,${cleanPhoto(model)}" width="${model.width}" height="${model.height}"/>
      ${placeBlock(textBlock(p, shot.ink), shot)}
    </svg>
  </svg>`;
  return render(svg).render().asPng();
}

let count = 0;
for (const p of catalog.products) {
  if (p.type !== "camiseta" || (only.size && !only.has(p.slug))) continue;
  for (const [g, model] of Object.entries(MODELS)) {
    for (const [color, shot] of Object.entries(model.shots)) {
      fs.writeFileSync(path.join(outDir, `${p.slug}-${g}-${color}.png`), photo(p, model, shot));
      count++;
    }
  }
}
console.log(`${count} fotos geradas em ${outDir}`);
