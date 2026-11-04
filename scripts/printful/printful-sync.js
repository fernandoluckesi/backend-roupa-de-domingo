// Cria os produtos na Printful (idempotente pelo external_id = slug) e gera mockups.
// Uso: node printful-sync.js <create|mockups> <pasta de saida dos mockups> [slug...]
const fs = require("fs");
const path = require("path");

const H = {
  Authorization: "Bearer " + process.env.PRINT_API_KEY,
  "X-PF-Store-Id": process.env.PRINTFUL_STORE_ID,
  "Content-Type": "application/json",
};
const BASE = "https://api.printful.com";
const DESIGN_URL = "https://frontend-roupa-de-domingo-production.up.railway.app/designs/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, url, body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(BASE + url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (res.status === 429) {
      const wait = (parseInt(res.headers.get("retry-after") || "30", 10) + 2) * 1000;
      console.log(`  rate limit, aguardando ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (res.status >= 400) {
      const err = new Error(`${method} ${url} -> ${res.status}: ${json?.error?.message || json?.result || ""}`);
      err.status = res.status;
      throw err;
    }
    return json.result;
  }
  throw new Error(`${method} ${url}: rate limit persistente`);
}

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));

// Sigla curta de cada produto para SKU / external_id das variantes
const CODE = {
  "camiseta-sorria-e-de-graca": "CAM-SORRIA",
  "camiseta-estou-bem-mentira": "CAM-BEM",
  "camiseta-trabalho-em-equipe": "CAM-EQUIPE",
  "camiseta-domingo-eterno": "CAM-DOMINGO",
  "camiseta-nao-foi-nada": "CAM-NADA",
  "camiseta-voce-nao-devia-estar-aqui": "CAM-SECRETA",
  "caneca-primeiro-cafe": "CAN-CAFE",
  "caneca-reuniao-email": "CAN-EMAIL",
  "caneca-chefe-do-ano": "CAN-CHEFE",
  "caneca-lagrimas-dos-meus-inimigos": "CAN-LAGRIMAS",
  "capa-visto-e-nao-respondido": "CAP-VISTO",
  "capa-bateria-social-2": "CAP-BATERIA",
  "capa-rolando-por-nada": "CAP-ROLANDO",
  "capa-ja-vou-sair-de-casa": "CAP-SAINDO",
  "moletom-socialmente-indisponivel": "MOL-INDISP",
  "moletom-domingo-18h": "MOL-18H",
  "garrafa-hidratado-e-cansado": "GAR-CANSADO",
  "garrafa-bebendo-agua-para-nao-responder": "GAR-AGUA",
};

const NAME = {
  "camiseta-sorria-e-de-graca": "Sorria, é de graça (o resto não)",
  "camiseta-estou-bem-mentira": "Estou bem (mentira estampada)",
  "camiseta-trabalho-em-equipe": "Trabalho bem em equipe (sozinho)",
  "camiseta-domingo-eterno": "Domingo é uma sensação, não um dia",
  "camiseta-nao-foi-nada": "\"Não foi nada\" (era tudo)",
  "camiseta-voce-nao-devia-estar-aqui": "Você não devia estar aqui",
  "caneca-primeiro-cafe": "Antes do café eu não assino contrato",
  "caneca-reuniao-email": "Isso podia ser um e-mail",
  "caneca-chefe-do-ano": "Chefe do ano (votação com 1 voto)",
  "caneca-lagrimas-dos-meus-inimigos": "Lágrimas dos meus inimigos (sem açúcar)",
  "capa-visto-e-nao-respondido": "Visto e não respondido",
  "capa-bateria-social-2": "Bateria social: 2%",
  "capa-rolando-por-nada": "Rolando a tela por nada específico",
  "capa-ja-vou-sair-de-casa": "\"Já estou saindo\" (ainda deitado)",
  "moletom-socialmente-indisponivel": "Socialmente indisponível",
  "moletom-domingo-18h": "Domingo, 18h. Pronto para o pânico",
  "garrafa-hidratado-e-cansado": "Hidratado e ainda assim cansado",
  "garrafa-bebendo-agua-para-nao-responder": "Bebendo água para não responder",
};

const SIZE_PT = { S: "P", M: "M", L: "G", XL: "GG", "2XL": "XGG", P: "P", G: "G", GG: "GG", XGG: "XGG" };
const COLOR_PT = { White: "Branca", Black: "Preta", Navy: "Marinho" };
const COLOR_CODE = { White: "BR", Black: "PT", Navy: "MA" };

const modelCode = (m) => m.replace(/^Samsung Galaxy /, "GALAXY").replace(/^iPhone /, "IP").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Bases da Printful por tipo. retail em BRL. */
const TYPES = {
  camiseta: { productIds: [509], retail: "89.90", placement: "default", match: (v) => ["White", "Black"].includes(v.color), ink: (v) => (v.color === "White" ? "dark" : "light"), file: () => "front" },
  moletom: { productIds: [146], retail: "219.90", placement: "default", match: (v) => ["Navy", "Black"].includes(v.color) && ["S", "M", "L", "XL", "2XL"].includes(v.size), ink: () => "light", file: () => "front" },
  caneca: { productIds: [19], retail: "69.90", placement: "default", match: (v) => v.id === 1320, ink: () => "dark", file: () => "default" },
  capa: {
    productIds: [181, 267],
    retail: "99.90",
    placement: "default",
    match: (v) =>
      [
        "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17", "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16",
        "iPhone 15 Pro", "iPhone 15", "iPhone 14", "iPhone 13",
        "Samsung Galaxy S25 Ultra", "Samsung Galaxy S25", "Samsung Galaxy S24 Ultra", "Samsung Galaxy S24", "Samsung Galaxy S23",
      ].includes(v.size),
    ink: () => "dark",
    file: (v) => (v.product_id === 267 ? "samsung" : "iphone"),
  },
  garrafa: { productIds: [382], retail: "219.90", placement: "default", match: () => true, ink: (v) => (v.color === "White" ? "dark" : "light"), file: () => "default" },
};

function variantInfo(type, v) {
  if (type === "capa") return { sku: modelCode(v.size), model: v.size.replace(/^Samsung /, ""), color: null, size: null };
  if (type === "caneca") return { sku: "325", size: "325ml", color: "Branca" };
  if (type === "garrafa") return { sku: COLOR_CODE[v.color], size: "500ml", color: COLOR_PT[v.color] };
  return { sku: `${COLOR_CODE[v.color]}-${SIZE_PT[v.size]}`, size: SIZE_PT[v.size], color: COLOR_PT[v.color] };
}

const catalogCache = {};
async function catalogVariants(pid) {
  if (!catalogCache[pid]) catalogCache[pid] = (await api("GET", `/products/${pid}`)).variants;
  return catalogCache[pid];
}

async function planFor(p) {
  const t = TYPES[p.type];
  const rows = [];
  for (const pid of t.productIds) {
    for (const v of await catalogVariants(pid)) {
      if (!t.match(v)) continue;
      const info = variantInfo(p.type, v);
      const ink = t.ink(v);
      rows.push({
        catalogProductId: pid,
        variantId: v.id,
        externalId: `${CODE[p.slug]}-${info.sku}`,
        retail: t.retail,
        ink,
        designUrl: `${DESIGN_URL}${p.slug}--${t.file(v)}--${ink}.png`,
        info,
        catalogColor: v.color,
      });
    }
  }
  return rows;
}

async function create(slugs) {
  const manifest = {};
  for (const p of catalog.products.filter((x) => !slugs.length || slugs.includes(x.slug))) {
    const rows = await planFor(p);
    let existing = null;
    try {
      existing = await api("GET", `/store/products/@${p.slug}`);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    if (existing) {
      console.log(`= ${p.slug}: ja existe (#${existing.sync_product.id}), ${existing.sync_variants.length} variantes`);
    } else {
      const body = {
        sync_product: { external_id: p.slug, name: NAME[p.slug] },
        sync_variants: rows.map((r) => ({
          external_id: r.externalId,
          variant_id: r.variantId,
          retail_price: r.retail,
          files: [{ type: TYPES[p.type].placement, url: r.designUrl }],
        })),
      };
      const res = await api("POST", "/store/products", body);
      console.log(`+ ${p.slug}: criado #${res.id} com ${rows.length} variantes`);
      await sleep(1500);
    }
    manifest[p.slug] = { type: p.type, variants: rows.map(({ externalId, info, variantId, catalogProductId, retail }) => ({ externalId, variantId, catalogProductId, retail, ...info })) };
  }
  const out = path.join(__dirname, "printful-manifest.json");
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log("manifest:", out);
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function mockups(outDir, slugs) {
  fs.mkdirSync(outDir, { recursive: true });
  const result = {};
  for (const p of catalog.products.filter((x) => !slugs.length || slugs.includes(x.slug))) {
    const rows = await planFor(p);
    // Uma variante por cor/produto base basta para as fotos
    const picks = [];
    const seen = new Set();
    for (const r of rows) {
      const key = `${r.catalogProductId}|${r.catalogColor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picks.push(r);
    }
    // Capa: so o primeiro produto base (iPhone) para nao duplicar fotos
    const chosen = p.type === "capa" ? picks.filter((r) => r.catalogProductId === 181).slice(0, 1) : picks;
    const images = [];
    for (const r of chosen) {
      const pf = await api("GET", `/mockup-generator/printfiles/${r.catalogProductId}`);
      const vpf = pf.variant_printfiles.find((x) => x.variant_id === r.variantId);
      const placement = Object.keys(vpf.placements)[0];
      const printfile = pf.printfiles.find((x) => x.printfile_id === vpf.placements[placement]);
      const task = await api("POST", `/mockup-generator/create-task/${r.catalogProductId}`, {
        variant_ids: [r.variantId],
        format: "jpg",
        files: [
          {
            placement,
            image_url: r.designUrl,
            position: { area_width: printfile.width, area_height: printfile.height, width: printfile.width, height: printfile.height, top: 0, left: 0 },
          },
        ],
      });
      let status;
      for (let i = 0; i < 40; i++) {
        await sleep(4000);
        status = await api("GET", `/mockup-generator/task?task_key=${task.task_key}`);
        if (status.status !== "pending") break;
      }
      if (status.status !== "completed") throw new Error(`${p.slug}: mockup ${status.status} ${status.error || ""}`);
      const urls = [];
      for (const m of status.mockups) {
        urls.push(m.mockup_url);
        for (const e of m.extra || []) urls.push(e.url);
      }
      // Ate 2 fotos por cor: a principal e uma alternativa
      for (const url of urls.slice(0, chosen.length > 1 ? 2 : 3)) {
        const name = `${p.slug}-${images.length + 1}.jpg`;
        await download(url, path.join(outDir, name));
        images.push({ file: name, color: r.info.color });
      }
      console.log(`  ${p.slug} ${r.catalogColor || ""}: ${urls.length} mockups (${images.length} salvos)`);
    }
    result[p.slug] = images;
  }
  const out = path.join(__dirname, "mockups-manifest.json");
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
  fs.writeFileSync(out, JSON.stringify({ ...prev, ...result }, null, 2));
  console.log("mockups:", out);
}

(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "create") await create(rest);
  else if (mode === "mockups") await mockups(rest[0], rest.slice(1));
  else if (mode === "plan") {
    for (const p of catalog.products) {
      const rows = await planFor(p);
      console.log(p.slug, rows.length, rows.slice(0, 3).map((r) => `${r.externalId}:${r.variantId}`).join(" "));
    }
  }
})().catch((e) => {
  console.error("ERRO", e.message);
  process.exit(1);
});
