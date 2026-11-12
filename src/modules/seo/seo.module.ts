import { Controller, Get, Header, Injectable, Module, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escapa JSON para dentro de <script> (evita fechar a tag com "</script>"). */
const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/** Rotas publicas estaticas que entram no sitemap. */
const STATIC_PAGES: { path: string; changefreq: string; priority: string; title: string; description: string }[] = [
  { path: "/", changefreq: "daily", priority: "1.0", title: "Roupa de Domingo — camisetas engraçadas e estampas com humor ácido", description: "Camisetas engraçadas, moletons, canecas e garrafas com estampas de humor ácido. Produção própria e entrega para todo o Brasil." },
  { path: "/catalogo", changefreq: "daily", priority: "0.9", title: "Camisetas engraçadas, moletons e canecas — catálogo | Roupa de Domingo", description: "Camisetas engraçadas, moletons, canecas e garrafas com estampas de humor ácido. Presente criativo com entrega para todo o Brasil." },
  { path: "/guia-de-tamanhos", changefreq: "monthly", priority: "0.6", title: "Guia de tamanhos | Roupa de Domingo", description: "Tabela de medidas, composição do tecido e cuidados de lavagem de cada peça." },
  { path: "/entrega", changefreq: "monthly", priority: "0.5", title: "Entrega e prazos | Roupa de Domingo", description: "Como funcionam a produção sob demanda, o frete e o rastreio dos pedidos." },
  { path: "/pagamentos", changefreq: "monthly", priority: "0.4", title: "Pagamentos | Roupa de Domingo", description: "Meios de pagamento, parcelamento, segurança e reembolso." },
  { path: "/trocas-e-devolucoes", changefreq: "monthly", priority: "0.5", title: "Trocas e devoluções | Roupa de Domingo", description: "Direito de arrependimento em 7 dias e troca por defeito em 90 dias." },
  { path: "/quem-somos", changefreq: "yearly", priority: "0.3", title: "Quem somos | Roupa de Domingo", description: "Quem está por trás das estampas e a identificação completa da loja." },
  { path: "/contato", changefreq: "yearly", priority: "0.3", title: "Contato e SAC | Roupa de Domingo", description: "Fale com o SAC: resposta em até 5 dias úteis." },
  { path: "/termos", changefreq: "yearly", priority: "0.2", title: "Termos de uso | Roupa de Domingo", description: "Regras de uso do site e das compras." },
  { path: "/privacidade", changefreq: "yearly", priority: "0.2", title: "Política de privacidade | Roupa de Domingo", description: "Como tratamos os seus dados pessoais (LGPD)." },
  { path: "/cookies", changefreq: "yearly", priority: "0.2", title: "Política de cookies | Roupa de Domingo", description: "O que o site guarda no seu navegador e como mudar a sua escolha." },
];

/** Rotas privadas: nunca indexar. */
const PRIVATE_PREFIXES = ["/conta", "/checkout", "/carrinho", "/pagamento", "/entrar", "/cadastro", "/esqueci-a-senha", "/redefinir-senha", "/verificar-email", "/confirmar-cadastro", "/trofeus", "/segredo", "/tchau"];

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get siteUrl(): string {
    return this.config.get<string>("frontendUrl", "http://localhost:5173").replace(/\/$/, "");
  }

  async sitemap(): Promise<string> {
    // Filtros do catalogo (?category=) tem canonical em /catalogo, entao nao entram no sitemap
    const products = await this.prisma.product.findMany({
      where: { isActive: true, isSecret: false },
      select: { slug: true, updatedAt: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
    });

    const url = (loc: string, extra = "") => `  <url><loc>${esc(this.siteUrl + loc)}</loc>${extra}</url>`;
    const entries = [
      ...STATIC_PAGES.map((p) => url(p.path, `<changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority>`)),

      ...products.map((p) => {
        const image = p.images[0]?.url;
        const imageTag = image
          ? `<image:image><image:loc>${esc(/^https?:/.test(image) ? image : this.siteUrl + image)}</image:loc></image:image>`
          : "";
        return url(`/produto/${p.slug}`, `<lastmod>${p.updatedAt.toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${imageTag}`);
      }),
    ];

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ...entries,
      "</urlset>",
    ].join("\n");
  }

  /**
   * Trecho do <head> por rota, injetado pelo nginx via SSI no index.html.
   * Robos e previews de link (WhatsApp, Instagram) nao executam JavaScript:
   * sem isto, toda pagina teria o mesmo titulo e nenhuma imagem de preview.
   */
  async headFor(rawPath: string): Promise<string> {
    const path = (rawPath || "/").split("?")[0].replace(/\/+$/, "") || "/";
    const site = this.siteUrl;
    const defaults = STATIC_PAGES[0];
    let title = defaults.title;
    let description = defaults.description;
    let image = `${site}/og-default.png`;
    let type = "website";
    let robots = "index, follow";
    const jsonLd: object[] = [];

    const product = path.match(/^\/produto\/([a-z0-9-]+)$/);
    const staticPage = STATIC_PAGES.find((p) => p.path === path);

    if (product) {
      const p = await this.prisma.product.findFirst({
        where: { slug: product[1], isActive: true },
        include: {
          images: { orderBy: { position: "asc" }, take: 3 },
          variants: { where: { isAvailable: true }, select: { priceCents: true, sku: true } },
          category: { select: { name: true, slug: true } },
        },
      });
      if (p && !p.isSecret) {
        title = `${p.name} | Roupa de Domingo`;
        description = p.shortDescription;
        const first = p.images[0]?.url;
        if (first) image = /^https?:/.test(first) ? first : `${site}${first}`;
        type = "product";
        const prices = p.variants.map((v) => v.priceCents);
        const low = prices.length ? Math.min(...prices) : p.basePriceCents;
        const high = prices.length ? Math.max(...prices) : p.basePriceCents;
        jsonLd.push({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          description: p.description,
          sku: p.variants[0]?.sku ?? p.slug,
          category: p.category.name,
          brand: { "@type": "Brand", name: "Roupa de Domingo" },
          image: p.images.map((i) => (/^https?:/.test(i.url) ? i.url : `${site}${i.url}`)),
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "BRL",
            lowPrice: (low / 100).toFixed(2),
            highPrice: (high / 100).toFixed(2),
            offerCount: p.variants.length || 1,
            availability: p.variants.length ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${site}/produto/${p.slug}`,
          },
          ...(p.ratingCount > 0
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.ratingCount } }
            : {}),
        });
      } else {
        robots = "noindex, follow";
      }
    } else if (staticPage) {
      title = staticPage.title;
      description = staticPage.description;
    } else if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      robots = "noindex, nofollow";
    }

    if (path === "/") {
      jsonLd.push(
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Roupa de Domingo",
          url: site,
          logo: `${site}/icons/icon-512.png`,
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Roupa de Domingo",
          url: site,
          inLanguage: "pt-BR",
        },
      );
    }

    const canonical = `${site}${path === "/" ? "/" : path}`;
    return [
      `<title data-ssi="1">${esc(title)}</title>`,
      `<meta data-ssi="1" name="description" content="${esc(description)}" />`,
      `<meta data-ssi="1" name="robots" content="${robots}" />`,
      `<link data-ssi="1" rel="canonical" href="${esc(canonical)}" />`,
      `<meta data-ssi="1" property="og:site_name" content="Roupa de Domingo" />`,
      `<meta data-ssi="1" property="og:locale" content="pt_BR" />`,
      `<meta data-ssi="1" property="og:type" content="${type}" />`,
      `<meta data-ssi="1" property="og:title" content="${esc(title)}" />`,
      `<meta data-ssi="1" property="og:description" content="${esc(description)}" />`,
      `<meta data-ssi="1" property="og:url" content="${esc(canonical)}" />`,
      `<meta data-ssi="1" property="og:image" content="${esc(image)}" />`,
      `<meta data-ssi="1" name="twitter:card" content="summary_large_image" />`,
      `<meta data-ssi="1" name="twitter:title" content="${esc(title)}" />`,
      `<meta data-ssi="1" name="twitter:description" content="${esc(description)}" />`,
      `<meta data-ssi="1" name="twitter:image" content="${esc(image)}" />`,
      ...jsonLd.map((block) => `<script data-ssi="1" type="application/ld+json">${jsonForScript(block)}</script>`),
    ].join("\n    ");
  }
}

@ApiExcludeController()
@Controller()
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  /** Servido em /sitemap.xml pelo nginx do frontend (proxy para /api/seo/sitemap.xml). */
  @Get("seo/sitemap.xml")
  @Header("Content-Type", "application/xml; charset=utf-8")
  @Header("Cache-Control", "public, max-age=3600")
  sitemap() {
    return this.seo.sitemap();
  }

  @Get("seo/head")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "public, max-age=300")
  head(@Query("path") path = "/") {
    return this.seo.headFor(path);
  }
}

@Module({
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
