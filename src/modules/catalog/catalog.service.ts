import { Injectable, NotFoundException } from "@nestjs/common";
import { Gender, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryProductsDto } from "./dto/query-products.dto";
import { CreateProductDto, UpdateProductDto } from "./dto/upsert-product.dto";

const PRODUCT_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  humor: true,
  gender: true,
  basePriceCents: true,
  tags: true,
  isFeatured: true,
  isSecret: true,
  rating: true,
  ratingCount: true,
  category: { select: { slug: true, name: true, emoji: true } },
  images: {
    orderBy: { position: "asc" },
    take: 2,
    select: { url: true, alt: true, color: true },
  },
  // Só variantes à venda: as desativadas pelo catalog:sync (ex.: cor que saiu de linha) não aparecem
  variants: {
    where: { isAvailable: true },
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      model: true,
      priceCents: true,
    },
    orderBy: { priceCents: "asc" },
  },
} satisfies Prisma.ProductSelect;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: QueryProductsDto, discoveredCount = 0) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    // Produtos secretos só entram na listagem para quem já achou 4+ easter eggs
    const canSeeSecret = (query.includeSecret ?? false) && discoveredCount >= 4;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(canSeeSecret ? {} : { isSecret: false }),
      ...(query.category?.length ? { category: { slug: { in: query.category } } } : {}),
      ...(query.humor?.length ? { humor: { in: query.humor } } : {}),
      // Masculino e feminino somam as pecas unissex: caneca, garrafa e modelagem
      // sem corte especifico servem para qualquer pessoa. Sem filtro = tudo.
      ...(query.gender?.length
        ? {
            gender: {
              in: query.gender.includes(Gender.UNISSEX)
                ? query.gender
                : [...query.gender, Gender.UNISSEX],
            },
          }
        : {}),
      ...(query.tags?.length ? { tags: { hasSome: query.tags } } : {}),
      ...(query.minPrice || query.maxPrice
        ? {
            basePriceCents: {
              ...(query.minPrice ? { gte: query.minPrice } : {}),
              ...(query.maxPrice ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              {
                shortDescription: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              { description: { contains: query.search, mode: "insensitive" } },
              { tags: { has: query.search.toLowerCase() } },
            ],
          }
        : {}),
    };

    const orderBy = this.buildOrderBy(query.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
      },
    };
  }

  findFeatured() {
    return this.prisma.product.findMany({
      where: { isActive: true, isSecret: false, isFeatured: true },
      select: PRODUCT_LIST_SELECT,
      orderBy: { ratingCount: "desc" },
      take: 8,
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        category: true,
        images: { orderBy: { position: "asc" } },
        variants: {
          where: { isAvailable: true },
          orderBy: [{ priceCents: "asc" }, { sku: "asc" }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        "Esse produto nao existe. Ou existiu e desistiu, como muita coisa.",
      );
    }

    const related = await this.prisma.product.findMany({
      where: {
        isActive: true,
        isSecret: false,
        id: { not: product.id },
        OR: [{ categoryId: product.categoryId }, { humor: product.humor }],
      },
      select: PRODUCT_LIST_SELECT,
      take: 4,
    });

    return { ...product, related };
  }

  listCategories() {
    return this.prisma.category.findMany({
      // Categoria descontinuada (ex.: capas de celular) permanece no banco por
      // causa da FK dos produtos desativados, mas sai do site quando nao tem
      // mais nenhum produto a venda.
      where: {
        slug: { not: "secretos" },
        products: { some: { isActive: true, isSecret: false } },
      },
      orderBy: { position: "asc" },
      include: {
        _count: {
          select: { products: { where: { isActive: true, isSecret: false } } },
        },
      },
    });
  }

  listHumors() {
    return [
      { value: "ACIDO", label: "Ácido", description: "Direto, sem anestesia." },
      {
        value: "SARCASTICO",
        label: "Sarcástico",
        description: "Elogio com veneno.",
      },
      {
        value: "EXISTENCIAL",
        label: "Existencial",
        description: "Dói porque é verdade.",
      },
      {
        value: "MEMES",
        label: "Memes",
        description: "Internet em forma de estampa.",
      },
      {
        value: "PARA_CASAIS",
        label: "Para casais",
        description: "A dois, com indireta inclusa.",
      },
      {
        value: "POLITICO",
        label: "Político",
        description: "Opinião vestível. Discuta no almoço.",
      },
      {
        value: "NERD",
        label: "Nerd",
        description: "Piada que só compila na sua cabeça.",
      },
    ];
  }

  /**
   * Opcoes do filtro de genero. UNISSEX e o "qualquer": nao restringe nada.
   * Escolher MASCULINO ou FEMININO soma as pecas unissex (ver findMany).
   */
  listGenders() {
    return [
      {
        value: "UNISSEX",
        label: "Qualquer",
        description: "Tudo que a loja tem, sem recorte de público.",
      },
      {
        value: "MASCULINO",
        label: "Masculino",
        description: "Modelagem masculina e as peças que servem para todos.",
      },
      {
        value: "FEMININO",
        label: "Feminino",
        description: "Modelagem feminina e as peças que servem para todos.",
      },
    ];
  }

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { slug: dto.categorySlug },
      select: { id: true },
    });

    return this.prisma.product.create({
      data: {
        slug: slugify(dto.name),
        name: dto.name,
        shortDescription: dto.shortDescription,
        description: dto.description,
        humor: dto.humor,
        gender: dto.gender,
        basePriceCents: dto.basePriceCents,
        categoryId: category.id,
        tags: dto.tags ?? [],
        isFeatured: dto.isFeatured ?? false,
        isSecret: dto.isSecret ?? false,
        variants: { create: dto.variants },
        images: {
          create: (dto.images ?? []).map((image, i) => ({
            ...image,
            position: i,
          })),
        },
      },
      include: { variants: true, images: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const { categorySlug, variants, images, name, ...rest } = dto;

    const categoryId = categorySlug
      ? (
          await this.prisma.category.findUniqueOrThrow({
            where: { slug: categorySlug },
            select: { id: true },
          })
        ).id
      : undefined;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(name ? { name, slug: slugify(name) } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { variants: true, images: true },
    });
  }

  async remove(id: string) {
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { archived: true };
  }

  private buildOrderBy(
    sort: QueryProductsDto["sort"],
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case "preco-asc":
        return { basePriceCents: "asc" };
      case "preco-desc":
        return { basePriceCents: "desc" };
      case "populares":
        return { ratingCount: "desc" };
      case "nome":
        return { name: "asc" };
      default:
        return { createdAt: "desc" };
    }
  }
}
