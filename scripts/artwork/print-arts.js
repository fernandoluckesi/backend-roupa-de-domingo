// Exporta as artes de impressao (PNG transparente, 300 DPI no tamanho real da estampa) para a
// producao: uma pasta por tipo de peca, so dos produtos a venda e so nas tintas usadas.
//
// Uso: node print-arts.js <pasta de saida>
//   (no repositorio de docs: catalog/print-arts)
//
// Tamanhos (a composicao e a mesma do render.js; muda so a resolucao):
//   camisetas e oversized, moletons (canguru e gola careca): 21 x 28 cm, dentro do A4 do DTF
//   canecas: 22,9 x 8,9 cm, a volta inteira da caneca (frase dos dois lados)
//   garrafas: 21,6 x 13,4 cm, frase centralizada na frente
//
// Nome dos arquivos: <frase>--para-peca-clara.png (tinta escura) e <frase>--para-peca-escura.png
// (tinta clara, com o verde-limao da marca nos destaques).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { catalog, artSvg, render } = require("./render");

const DPI = 300;
const CM = DPI / 2.54;

/** Largura real de cada tipo em cm (a altura segue a proporcao do arquivo). */
const PRINT = {
  camiseta: { folder: "camisetas-e-oversized", widthCm: 21 },
  moletom: { folder: "moletons", widthCm: 21 },
  caneca: { folder: "canecas", widthCm: 22.86 },
  garrafa: { folder: "garrafas", widthCm: 21.65 },
};

const INK_FILE = { dark: "para-peca-clara", light: "para-peca-escura" };

/** Grava a resolucao no PNG (chunk pHYs), para o arquivo abrir no tamanho real. */
function withDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8); // unidade: metro
  const type = Buffer.from("pHYs");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])) >>> 0, 8 + data.length);
  // Logo depois do IHDR (assinatura de 8 bytes + IHDR de 25)
  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
}

const outDir = process.argv[2];
if (!outDir) throw new Error("Uso: node print-arts.js <pasta de saida>");

let count = 0;
for (const p of catalog.products) {
  const spec = PRINT[p.type];
  if (!spec) continue; // capas de celular: fora de linha
  const t = catalog.types[p.type];
  const fileKey = Object.keys(t.files)[0];
  const [w] = t.files[fileKey];
  const scale = (spec.widthCm * CM) / w;
  const key = p.slug.slice(p.type.length + 1);
  const dir = path.join(outDir, spec.folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const ink of t.inks) {
    const png = render(artSvg(p, ink, fileKey, scale)).render().asPng();
    fs.writeFileSync(path.join(dir, `${key}--${INK_FILE[ink]}.png`), withDpi(png, DPI));
    count++;
  }
}
console.log(`${count} artes de impressao (${DPI} DPI) em ${outDir}`);
