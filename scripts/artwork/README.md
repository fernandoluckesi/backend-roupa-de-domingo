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

## Mockups do site

`mockup.js <pasta products> [slug...]` gera as fotos de produto para o site a partir
das fotos-base já existentes (camiseta, moletom, caneca e garrafa). Ele apaga a estampa
antiga e aplica a frase nova. Sem slugs, gera só para os produtos sem `<slug>-1.jpg`.
Precisa também do pacote `pngjs`.

A saída é PNG. Converta para JPG (qualidade ~85) antes do commit, por exemplo com
System.Drawing no PowerShell, e apague os PNGs.

## Fotos das camisetas com modelo

`model-mockup.js <pasta models> <saída> [slug...]` gera as fotos das camisetas a partir de
`frontend/src/assets/models` (`male.jpeg` e `female.jpeg`: o mesmo modelo de camiseta branca e
preta, lado a lado, com a estampa "ESTOU BEM" de exemplo). Ele apaga a estampa de exemplo,
aplica a frase no mesmo tamanho e separa cada cor numa foto quadrada:
`<slug>-<m|f>-<preta|branca>.png`.

`prisma/catalog.ts` escolhe as fotos pelo gênero: masculina usa `m`, feminina usa `f` e
unissex usa as duas. Se trocar as fotos-base, ajuste as coordenadas em `MODELS`.

## Depois de mudar o catálogo

1. Atualize `prisma/catalog.ts` (produtos, variantes e imagens) e faça o commit.
2. O deploy roda `npm run catalog:sync`.
