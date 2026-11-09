# Artes de impressão

Gera os PNGs de impressão das estampas, a partir das frases do catálogo.

Os arquivos gerados vão para `frontend/public/designs`. São esses que a equipe usa na produção: DTF, sublimação ou DTG. Os mockups do site ficam em `frontend/public/products`.

## Como rodar

Rode a partir de uma pasta temporária que tenha:
- o pacote `@resvg/resvg-js` instalado;
- as fontes Archivo Black e Space Grotesk em `fonts/` (Google Fonts, licença OFL).

| Arquivo | Função |
| ------- | ------ |
| `catalog.json` | Frases de cada produto e tamanho do arquivo por tipo |
| `render.js <saída>` | Gera os PNGs de impressão |

## Depois de mudar o catálogo

1. Atualize `prisma/catalog.ts` (produtos, variantes e imagens) e faça o commit.
2. O deploy roda `npm run catalog:sync`.
