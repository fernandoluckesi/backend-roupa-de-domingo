import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryProductsDto } from "./dto/query-products.dto";
import { CreateProductDto, UpdateProductDto } from "./dto/upsert-product.dto";

const PRODUCT_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  humor: true,
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
    select: { url: true, alt: true },
  },
  variants: {
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
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.humor ? { humor: query.humor } : {}),
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
        variants: { orderBy: [{ priceCents: "asc" }, { sku: "asc" }] },
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
      where: { slug: { not: "secretos" } },
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
        value: "ABSURDO",
        label: "Absurdo",
        description: "Nenhum sentido, muito charme.",
      },
      {
        value: "PASSIVO_AGRESSIVO",
        label: "Passivo-agressivo",
        description: "Diz sem dizer.",
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
        basePriceCents: dto.basePriceCents,
        categoryId: category.id,
        tags: dto.tags ?? [],
        isFeatured: dto.isFeatured ?? false,
        isSecret: dto.isSecret ?? false,
        printProviderSku: dto.printProviderSku,
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
