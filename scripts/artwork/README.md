# Artes de impressão

Gera os PNGs de impressão das estampas, a partir das frases do catálogo.

Os arquivos gerados vão para `frontend/public/designs`. São esses que a equipe usa na produção: DTF, sublimação ou DTG. Os mockups do site ficam em `frontend/public/products`.

## Como rodar

Rode a partir de uma pasta temporária que tenha:
- o pacote `@resvg/resvg-js` instalado;
- as fontes de `fonts.js` copiadas para `fonts/`. Os arquivos e as licenças ficam em
  `frontend/scripts/brand/fonts`.

## Tipografia das estampas

A mesma em todas as artes, como marca registrada da loja (`fonts.js`). A Mouldy Cheese (NH Fonts) é
livre para uso comercial; as demais são Google Fonts com licença SIL OFL, que libera o uso
comercial.

| Uso | Fonte | Onde |
| --- | ----- | ---- |
| Frase principal | Mouldy Cheese, em maiúsculas | `lines` |
| Frase de baixo, que fecha a piada | Pacifico, em minúsculas (convertidas no script) | `small` |
| Texto corrido da estampa-lista | Space Grotesk Medium | `items` |
| Legenda de meme com personagem | Bangers | `caption` |

O Space Grotesk é um arquivo estático (`SpaceGrotesk-Medium.ttf`, do pacote `@fontsource`): com a
fonte variável o resvg ignora o peso e desenha a versão fina. A família gravada no arquivo é
"Space Grotesk Light Medium", e é esse o nome usado em `fonts.js`.

| Arquivo | Função |
| ------- | ------ |
| `catalog.json` | Frases de cada produto e tamanho do arquivo por tipo |
| `render.js <saída>` | Gera os PNGs de impressão |

## Mockups do site

`mockup.js <pasta de saída> [slug...]` gera as fotos de produto das peças do fornecedor a partir das
fotos-base em `bases/` (1000×1000, fundo branco, sem estampa; vieram do catálogo do fornecedor, com as
cores extras recoloridas). Cada entrada do `catalog.json` gera todas as versões vendidas da estampa:

| Entrada | Arquivos gerados |
| ------- | ---------------- |
| `camiseta-<frase>` | `oversized-<frase>` |
| `moletom-<frase>` | `moletom-<frase>-<cinza\|preta\|branca>` e `moletom-gola-careca-<frase>-<cor>` |
| `caneca-<frase>` | `caneca-<frase>-<branca\|preta\|magica\|termica\|coracao>` |
| `garrafa-<frase>` | `garrafa-<frase>-<queta-preta\|queta-branca\|queta-roxa\|queta-azul\|norton>` |

Sem slugs, gera tudo. Precisa também do pacote `pngjs`. Os produtos, as cores e os preços dessas
versões são montados no fim de `prisma/catalog.ts` (linha do fornecedor).

A saída é PNG. Converta para JPG (qualidade ~85) antes do commit, por exemplo com
`sips -s format jpeg` no macOS, e apague os PNGs.

## Fotos das camisetas com modelo

`model-mockup.js <pasta models> <saída> [slug...]` gera as fotos das camisetas a partir de
`frontend/src/assets/models` (`male.jpeg` e `female.jpeg`: o mesmo modelo de camiseta branca e
preta, lado a lado, com a estampa "ESTOU BEM" de exemplo). Ele apaga a estampa de exemplo,
aplica a frase no mesmo tamanho e separa cada cor numa foto quadrada:
`<slug>-<m|f>-<preta|branca>.png`.

`prisma/catalog.ts` escolhe as fotos pelo gênero: masculina usa `m`, feminina usa `f` e
unissex usa as duas. Se trocar as fotos-base, ajuste as coordenadas em `MODELS`.

## Estampa-lista (várias frases)

Uma entrada com `"layout": "list"` e `items` (ex.: "As 13 melhores frases já ditas") usa o
`list-layout.js`. O título vem de `lines` e o subtítulo de `small`; as frases são numeradas e
alinhadas à esquerda. O script testa várias larguras de quebra de linha e fica com a que deixa a
letra maior na área. A área é a `listArea` do tipo (arte de impressão) e `listArt`/`listErase`
nas fotos (`mockup.js` e `model-mockup.js`).

## Estampa desenhada (imagem)

Uma entrada com `"layout": "image"` e `image` (ex.: "Eu prefiro morrer do que perder a vida!") usa o
`image-layout.js`. O desenho fica em `images/`, em PNG com fundo branco. Ele é tratado como arte de uma
cor só: o branco vira transparente e o traço recebe a cor da tinta (escura em peça clara, clara em
peça escura). Usa a mesma área alta da estampa-lista (`listArea` / `listArt`) e precisa do pacote `pngjs`.

A legenda dos memes usa sempre a fonte padrão de meme (Bangers). Se o desenho já vem com texto,
`erase` apaga esses retângulos (em pixels do desenho) e `caption` escreve a legenda de novo:
`{ "lines": [...], "box": [x, y, largura, altura] }`, com a caixa também em pixels do desenho.

## Depois de mudar o catálogo

1. Atualize `prisma/catalog.ts` (produtos, variantes e imagens) e faça o commit.
2. O deploy roda `npm run catalog:sync`.
