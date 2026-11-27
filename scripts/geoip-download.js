/**
 * Baixa o banco gratuito de cidades por IP (DB-IP "IP to City Lite", licenca CC BY 4.0,
 * atualizado todo mes) para data/geoip/dbip-city-lite.mmdb, usado pela analise de acessos
 * para mostrar pais, estado e cidade das visitas. O IP das visitas nunca e guardado.
 *
 *   npm run geoip:download
 *
 * Nao precisa se o dominio passa pelo Cloudflare com "Add visitor location headers" ligado.
 * Atribuicao exigida pela licenca: "IP Geolocation by DB-IP" (https://db-ip.com).
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");

const OUT = process.env.GEOIP_DB_PATH ?? path.join(__dirname, "..", "data", "geoip", "dbip-city-lite.mmdb");

function month(offset) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // O arquivo do mes sai nos primeiros dias: tenta o atual e, se nao existir ainda, o anterior
  for (const m of [month(0), month(-1)]) {
    const url = `https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`;
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      console.log(`${url}: ${res.status}`);
      continue;
    }
    const tmp = `${OUT}.tmp`;
    await pipeline(Readable.fromWeb(res.body), zlib.createGunzip(), fs.createWriteStream(tmp));
    fs.renameSync(tmp, OUT);
    console.log(`Banco GeoIP ${m} salvo em ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(0)} MB)`);
    return;
  }
  throw new Error("Nao foi possivel baixar o banco do DB-IP.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
