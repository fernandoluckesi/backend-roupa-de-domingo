// Gera os mockups do site (frontend/public/products) de moletons, canecas e garrafas.
//
// Parte de uma foto-base de cada tipo/cor (mockups ja existentes), apaga a estampa
// antiga e aplica a frase nova com a mesma tipografia das artes:
// - cada coluna da area apagada e refeita interpolando a cor da linha logo acima com a
//   da linha logo abaixo (mantem sombra e curvatura sem emenda);
// - quando ha um trecho limpo do mesmo tecido (texture), a textura dele e somada por cima.
//
// Uso: node mockup.js <pasta products> [slug...]
//   Sem slugs: gera para todo produto do catalog.json que ainda nao tem <slug>-1.jpg.
//   Saida em PNG; converta para JPG (ver README).
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { PNG } = require("pngjs");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const productsDir = process.argv[2];
const only = new Set(process.argv.slice(3));

const FONT_FILES = [
  path.join(__dirname, "fonts", "ArchivoBlack-Regular.ttf"),
  path.join(__dirname, "fonts", "SpaceGrotesk-var.ttf"),
];
const INK = { dark: "#141414", light: "#F5F5F0" };
const ACCENT = { dark: "#141414", light: "#D9FF3F" };
const SIZE = 1000;

/**
 * Fotos-base por tipo (coordenadas na foto 1000x1000):
 * - erase: [x, y, w, h] que cobre a estampa antiga, com folga;
 * - texture: y de um trecho limpo do mesmo tamanho, nas mesmas colunas (opcional);
 * - art: retangulo onde a frase nova e encaixada; maxScale limita o tamanho da letra.
 */
const BASES = {
  // Camisetas usam fotos com modelo: ver model-mockup.js
  moletom: {
    shots: [
      { n: 1, file: "moletom-domingo-18h-1.jpg", ink: "light" },
      { n: 2, file: "moletom-domingo-18h-3.jpg", ink: "light" },
    ],
    erase: [330, 250, 330, 146],
    art: [345, 258, 305, 130],
    maxScale: 0.22,
  },
  caneca: {
    shots: [{ n: 1, file: "caneca-chefe-do-ano-1.jpg", ink: "dark" }],
    erase: [190, 312, 455, 464],
    art: [215, 330, 400, 420],
    maxScale: 0.5,
  },
  garrafa: {
    shots: [
      { n: 1, file: "garrafa-hidratado-e-cansado-1.jpg", ink: "light" },
      { n: 2, file: "garrafa-hidratado-e-cansado-3.jpg", ink: "dark" },
    ],
    erase: [372, 556, 256, 180],
    art: [398, 564, 204, 158],
    maxScale: 0.2,
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function textBlock(p, ink) {
  const size = 200;
  let y = size;
  let out = "";
  for (const line of p.lines) {
    out += `<text x="0" y="${y}" text-anchor="middle" font-family="Archivo Black" font-size="${size}" fill="${INK[ink]}" letter-spacing="-4">${esc(line)}</text>`;
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

function placeBlock(inner, [ax, ay, aw, ah], maxScale) {
  const W = 6000;
  const b = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}"><g transform="translate(${W / 2},500)">${inner}</g></svg>`).getBBox();
  const bx = b.x - W / 2, by = b.y - 500;
  // Frases curtas nao devem virar letreiro: limita o tamanho da letra
  const s = Math.min(aw / b.width, ah / b.height, maxScale);
  const tx = ax + aw / 2 - (bx + b.width / 2) * s;
  const ty = ay + ah / 2 - (by + b.height / 2) * s;
  return `<g transform="translate(${tx},${ty}) scale(${s})">${inner}</g>`;
}

/** Foto-base sem a estampa antiga, em PNG (decodificada pelo proprio resvg). */
const cleanCache = new Map();
function cleanPhoto(file, base) {
  if (cleanCache.has(file)) return cleanCache.get(file);
  const jpeg = fs.readFileSync(path.join(productsDir, file)).toString("base64");
  const px = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><image href="data:image/jpeg;base64,${jpeg}" width="${SIZE}" height="${SIZE}"/></svg>`).render().pixels;
  const at = (x, y, c) => px[(y * SIZE + x) * 4 + c];
  const [ex, ey, ew, eh] = base.erase;
  const top = ey - 1, bottom = ey + eh;
  const out = Buffer.from(px);
  for (let x = ex; x < ex + ew; x++) {
    for (let y = ey; y < bottom; y++) {
      const t = (y - top) / (bottom - top);
      for (let c = 0; c < 3; c++) {
        let v = at(x, top, c) * (1 - t) + at(x, bottom, c) * t;
        if (base.texture != null) {
          // Textura: desvio do trecho limpo em relacao a propria interpolacao
          const sy = base.texture + (y - ey);
          const st = base.texture - 1, sb = base.texture + eh;
          const ts = (sy - st) / (sb - st);
          v += at(x, sy, c) - (at(x, st, c) * (1 - ts) + at(x, sb, c) * ts);
        }
        out[(y * SIZE + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }
  const png = new PNG({ width: SIZE, height: SIZE });
  out.copy(png.data);
  const b64 = PNG.sync.write(png).toString("base64");
  cleanCache.set(file, b64);
  return b64;
}

function mockup(p, base, shot) {
  const photo = cleanPhoto(shot.file, base);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <image href="data:image/png;base64,${photo}" width="${SIZE}" height="${SIZE}"/>
    ${placeBlock(textBlock(p, shot.ink), base.art, base.maxScale)}
  </svg>`;
  return render(svg).render().asPng();
}

let count = 0;
for (const p of catalog.products) {
  const base = BASES[p.type];
  if (!base) continue;
  if (only.size ? !only.has(p.slug) : fs.existsSync(path.join(productsDir, `${p.slug}-1.jpg`))) continue;
  for (const shot of base.shots) {
    fs.writeFileSync(path.join(productsDir, `${p.slug}-${shot.n}.png`), mockup(p, base, shot));
    count++;
  }
}
console.log(`${count} mockups gerados em ${productsDir}`);
