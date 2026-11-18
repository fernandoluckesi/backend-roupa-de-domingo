// Assinatura da marca embaixo de cada estampa: o logotipo "Roupa de Domingo" (Archivo Black) com o
// subtitulo "ESTAMPAS SEM ANESTESIA" (Space Grotesk SemiBold, maiusculas espacadas), com as mesmas
// medidas da logo do site. Pequena e discreta: nao compete com a frase.
//
// Cores da logo: em peca escura (tinta clara) o titulo sai off-white e o subtitulo verde-limao; em
// peca clara (tinta escura) os dois saem na cor da tinta, porque o limao some no branco.
//
// Usado por text-block.js, list-layout.js e image-layout.js.
const { FONTS } = require("./fonts");

const LOGO = { title: "#F4F4F5", tagline: "#D7FF3E" };
const TITLE = "Roupa de Domingo";
const TAGLINE = "ESTAMPAS SEM ANESTESIA";
// Medidas iguais as da logo do site (frontend scripts/brand/generate-logo.mjs): titulo 96 com
// tracking -0,02em na linha de base 90; subtitulo 30 com tracking 0,16em na linha de base 158,
// recuado 4. O bloco e escalado depois para a largura pedida.
const LOGO_TITLE = { size: 96, tracking: -0.02, baseline: 90 };
const LOGO_TAG = { size: 30, tracking: 0.16, baseline: 158, indent: 4 };

/** Tinta clara (peca escura)? Decide pela luminancia da cor #rrggbb. */
function isLightInk(fill) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 128;
}

/** Cor de destaque das frases: verde-limao da logo em peca escura, a propria tinta em peca clara. */
const accentFor = (fill) => (isLightInk(fill) ? LOGO.tagline : fill);

/**
 * Assinatura com largura `width` (unidades do bloco), alinhada em x (`anchor`: "middle" ou
 * "start") e com o topo em y. `measure(inner)` devolve o bbox { x, y, width, height }.
 */
function signature(fill, measure, { x = 0, y, width, anchor = "middle" }) {
  const light = isLightInk(fill);
  const titleFill = light ? LOGO.title : fill;
  const taglineFill = light ? LOGO.tagline : fill;
  const title =
    `<text x="0" y="${LOGO_TITLE.baseline}" font-family="${FONTS.LOGO}" font-size="${LOGO_TITLE.size}"` +
    ` letter-spacing="${LOGO_TITLE.tracking * LOGO_TITLE.size}" fill="${titleFill}">${TITLE}</text>`;
  const tagline =
    `<text x="${LOGO_TAG.indent}" y="${LOGO_TAG.baseline}" font-family="${FONTS.LOGO_TAGLINE}" font-size="${LOGO_TAG.size}"` +
    ` letter-spacing="${LOGO_TAG.tracking * LOGO_TAG.size}" fill="${taglineFill}">${TAGLINE}</text>`;
  const t = measure(title + tagline);
  const s = width / t.width;
  const left = anchor === "middle" ? x - (width / 2) : x;
  const tx = left - t.x * s;
  const ty = y - t.y * s;
  return `<g transform="translate(${tx},${ty}) scale(${s})">${title}${tagline}</g>`;
}

/**
 * Bloco + assinatura centrada embaixo dele. A assinatura tem ~30% da largura do bloco, dentro de
 * [min, max] (unidades do bloco), e fica a `gap` do fim do bloco.
 */
function withSignature(inner, fill, measure, { min = 360, max = 600, gap = 90, anchor = "middle" } = {}) {
  const b = measure(inner);
  const width = Math.max(min, Math.min(max, b.width * 0.3));
  const x = anchor === "middle" ? b.x + b.width / 2 : b.x;
  return inner + signature(fill, measure, { x, y: b.y + b.height + gap, width, anchor });
}

module.exports = { signature, withSignature, accentFor, isLightInk };
