// Envolve a estampa num cilindro (canecas e garrafas), como a impressao de verdade fica na foto.
//
// A arte e desenhada "aberta" (como o papel antes de enrolar) e cada pixel da foto busca o ponto
// correspondente nela:
// - largura: perto das bordas do cilindro a superficie vira de lado, entao as letras ficam mais
//   estreitas (x = cx + r * sen(angulo));
// - curvatura: a camera olha um pouco de cima, entao as linhas horizontais viram arcos que sobem
//   nas bordas, como a boca da caneca (tilt = altura / largura da elipse da boca);
// - luz: a tinta perde um pouco de forca onde a superficie se afasta da camera.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * overlay: RGBA pre-multiplicado W x H com a estampa aberta (centrada em cx).
 * cyl: { cx, r, tilt }. Devolve um novo buffer com a estampa enrolada.
 */
function wrapCylinder(overlay, W, H, { cx, r, tilt }) {
  const out = Buffer.alloc(overlay.length);
  const x0 = Math.max(0, Math.ceil(cx - r)), x1 = Math.min(W - 1, Math.floor(cx + r));
  for (let x = x0; x <= x1; x++) {
    const s = clamp((x + 0.5 - cx) / r, -1, 1);
    const theta = Math.asin(s);
    const cos = Math.cos(theta);
    const u = cx + r * theta - 0.5;
    const lift = tilt * r * (1 - cos);
    const fade = 0.8 + 0.2 * cos;
    const ix = Math.floor(u), tx = u - ix;
    if (ix < 0 || ix >= W - 1) continue;
    for (let y = 0; y < H; y++) {
      const v = y + lift;
      const iy = Math.floor(v), ty = v - iy;
      if (iy < 0 || iy >= H - 1) continue;
      const a = (iy * W + ix) * 4, b = a + 4, c = a + W * 4, d = c + 4;
      if (!(overlay[a + 3] | overlay[b + 3] | overlay[c + 3] | overlay[d + 3])) continue;
      const o = (y * W + x) * 4;
      for (let k = 0; k < 4; k++) {
        const top = overlay[a + k] * (1 - tx) + overlay[b + k] * tx;
        const bottom = overlay[c + k] * (1 - tx) + overlay[d + k] * tx;
        out[o + k] = Math.round((top * (1 - ty) + bottom * ty) * fade);
      }
    }
  }
  return out;
}

module.exports = { wrapCylinder };
