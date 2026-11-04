# Ferramentas do catálogo Printful

Geram as artes, criam os produtos na Printful e produzem os mockups usados no site.
Rodar a partir de uma pasta temporária com `@resvg/resvg-js` instalado e as fontes
Archivo Black e Space Grotesk em `fonts/` (Google Fonts, licença OFL).

| Arquivo | Função |
| ------- | ------ |
| `catalog.json` | Frases de cada produto e tamanho de arquivo por tipo |
| `render.js <saída>` | Gera os PNGs de impressão (vão para `frontend/public/designs`) |
| `printful-sync.js create [slug...]` | Cria os sync products (idempotente: `external_id` = slug). Usa as artes publicadas em `https://<front>/designs/` |
| `printful-sync.js mockups <saída> [slug...]` | Gera mockups no mockup generator e salva em `frontend/public/products` |
| `gen_catalog.py` | Gera `prisma/catalog.ts` a partir do seed + manifests |
| `printful-manifest.json` / `mockups-manifest.json` | Resultado da última execução (04/11/2026) |

Variáveis: `PRINT_API_KEY` e `PRINTFUL_STORE_ID` (do `.env` da raiz).
Depois de mudar o catálogo: commit em `prisma/catalog.ts`; o deploy roda `npm run catalog:sync`.
