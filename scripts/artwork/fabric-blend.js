// Aplica a estampa sobre a foto do tecido de forma natural (usado por mockup.js e model-mockup.js).
//
// Em vez de "colar" o texto por cima, a tinta segue o tecido:
// - deslocamento: a estampa entorta levemente nas dobras (gradiente da luz do tecido);
// - sombreamento: onde o tecido esta na sombra a tinta escurece, onde esta na luz ela clareia;
// - textura: o detalhe fino do pano (trama, amassados) aparece por cima da tinta;
// - tecido claro usa multiplicacao (tinta escura absorve a luz do tecido), como DTG em camiseta branca.

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Media movel (caixa) separavel de raio r sobre uma grade w x h. */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      acc += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

/**
 * base: RGBA (Buffer, sem pre-multiplicacao) da foto, alterado no lugar.
 * overlay: RGBA pre-multiplicado (pixels do resvg) com so a estampa, mesmo tamanho da foto.
 * region: [x, y, w, h] onde a estampa esta. fabric: "light" (branco) ou "dark" (preto, marinho).
 * rigid: superficie dura (caneca, garrafa): sem o deslocamento das dobras do tecido.
 */
function blendPrint(base, overlay, W, H, region, fabric, { rigid = false } = {}) {
  const bend = rigid ? 0 : 0.25;
  const pad = 16;
  const x0 = clamp(Math.floor(region[0] - pad), 0, W - 1);
  const y0 = clamp(Math.floor(region[1] - pad), 0, H - 1);
  const x1 = clamp(Math.ceil(region[0] + region[2] + pad), 1, W);
  const y1 = clamp(Math.ceil(region[1] + region[3] + pad), 1, H);
  const w = x1 - x0, h = y1 - y0;

  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * W + (x + x0)) * 4;
      L[y * w + x] = lum(base[i], base[i + 1], base[i + 2]);
    }
  const smooth = boxBlur(L, w, h, 10); // luz/sombra do tecido
  const folds = boxBlur(L, w, h, 3); // dobras, para o deslocamento

  // Luz media do tecido debaixo da estampa: referencia do sombreamento
  let sum = 0, n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (overlay[((y + y0) * W + (x + x0)) * 4 + 3] > 0) { sum += smooth[y * w + x]; n++; }
  const ref = Math.max(n ? sum / n : 1, 1);

  // Amostra bilinear da estampa (cor sem pre-multiplicacao + alfa)
  const sample = (fx, fy) => {
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const acc = [0, 0, 0, 0];
    for (const [dx, dy, wt] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
      const i = (clamp(iy + dy, 0, H - 1) * W + clamp(ix + dx, 0, W - 1)) * 4;
      for (let c = 0; c < 4; c++) acc[c] += overlay[i + c] * wt;
    }
    const a = acc[3];
    return a > 0 ? [(acc[0] * 255) / a, (acc[1] * 255) / a, (acc[2] * 255) / a, a / 255] : null;
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      // A estampa "escorrega" para o lado escuro da dobra, como tecido que afunda
      const gx = (folds[k + 1] - folds[k - 1]) / 2;
      const gy = (folds[k + w] - folds[k - w]) / 2;
      const px = x + x0 - clamp(gx * bend, -2.5, 2.5);
      const py = y + y0 - clamp(gy * bend, -2.5, 2.5);
      const ink = sample(px, py);
      if (!ink) continue;

      const i = ((y + y0) * W + (x + x0)) * 4;
      const shade = clamp(smooth[k] / ref, 0.55, 1.45);
      const detail = L[k] - smooth[k];
      const alpha = ink[3] * 0.94;
      for (let c = 0; c < 3; c++) {
        let printed;
        if (fabric === "light") {
          // Tinta escura em tecido claro: multiplica pela luz do tecido
          printed = (ink[c] * base[i + c]) / 255;
        } else {
          // Tinta clara em tecido escuro: acompanha luz e sombra e herda a textura
          printed = ink[c] * 0.92 * (0.62 + 0.38 * shade) + detail * 1.4;
        }
        base[i + c] = clamp(Math.round(base[i + c] * (1 - alpha) + printed * alpha), 0, 255);
      }
    }
  }
  return base;
}

module.exports = { blendPrint };
