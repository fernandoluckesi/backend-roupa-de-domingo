// Gera as artes (PNG transparente) de cada produto a partir de catalog.json.
// Uso: node render.js <pasta de saida>
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

const FONT_FILES = [
  path.join(__dirname, "fonts", "ArchivoBlack-Regular.ttf"),
  path.join(__dirname, "fonts", "SpaceGrotesk-var.ttf"),
];
const INK = { dark: "#141414", light: "#F5F5F0" };
const ACCENT = { dark: "#141414", light: "#D9FF3F" };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function textBlock(p, ink) {
  // Bloco em coordenadas livres; depois e escalado para caber na area
  const size = 200;
  const lh = size * 1.0;
  let y = size;
  let out = "";
  for (const line of p.lines) {
    out += `<text x="0" y="${y}" text-anchor="middle" font-family="Archivo Black" font-size="${size}" fill="${INK[ink]}" letter-spacing="-4">${esc(line)}</text>`;
    y += lh;
  }
  if (p.small) {
    y += size * 0.05;
    out += `<text x="0" y="${y}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${size * 0.42}" fill="${INK[ink]}">${esc(p.small)}</text>`;
    y += size * 0.42;
  }
  y += size * 0.45;
  out += `<text x="0" y="${y}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${size * 0.26}" letter-spacing="14" fill="${ACCENT[ink]}">ROUPA DE DOMINGO</text>`;
  return out;
}

function render(svg) {
  return new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Archivo Black" },
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
      const inner = textBlock(p, ink);
      const a = t.area;
      let body;
      if (t.wrap) {
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
