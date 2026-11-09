import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Cart, CouponType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ShippingService, ShippingOption } from "../shipping/shipping.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart.dto";

export interface CartOwner {
  userId?: string;
  sessionId?: string;
}

const CART_INCLUDE = {
  coupon: true,
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              humor: true,
              images: { orderBy: { position: "asc" }, select: { url: true, color: true } },
              category: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;

export interface CartTotals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  weightGrams: number;
  itemCount: number;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
  ) {}

  // ---------------------------------------------------------------- acesso

  async getOrCreateCart(owner: CartOwner): Promise<Cart> {
    if (!owner.userId && !owner.sessionId) {
      throw new BadRequestException(
        "Sem login nem header x-session-id nao da para manter carrinho.",
      );
    }

    const where: Prisma.CartWhereInput = owner.userId
      ? { userId: owner.userId }
      : { sessionId: owner.sessionId };

    const existing = await this.prisma.cart.findFirst({ where });
    if (existing) return existing;

    return this.prisma.cart.create({
      data: owner.userId
        ? { userId: owner.userId }
        : { sessionId: owner.sessionId! },
    });
  }

  async getCart(owner: CartOwner, zipCode?: string, method = "economico") {
    const cart = await this.getOrCreateCart(owner);
    return this.buildCartResponse(cart.id, zipCode, method);
  }

  // ---------------------------------------------------------------- itens

  async addItem(owner: CartOwner, dto: AddCartItemDto) {
    const cart = await this.getOrCreateCart(owner);

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: dto.variantId,
        isAvailable: true,
        product: { isActive: true },
      },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException(
        "Essa variante nao esta disponivel. A estamparia tambem tem limites.",
      );
    }

    const quantity = dto.quantity ?? 1;

    await this.prisma.cartItem.upsert({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
      },
      create: {
        cartId: cart.id,
        variantId: dto.variantId,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });

    await this.touch(cart.id);
    return this.buildCartResponse(cart.id);
  }

  async updateItem(owner: CartOwner, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(owner);
    await this.assertItemInCart(cart.id, itemId);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    await this.touch(cart.id);
    const response = await this.buildCartResponse(cart.id);

    return {
      ...response,
      // gatilho do easter egg QUARENTA_E_DOIS, validado no servidor
      easterEggTrigger: dto.quantity === 42 ? "QUARENTA_E_DOIS" : null,
    };
  }

  async removeItem(owner: CartOwner, itemId: string) {
    const cart = await this.getOrCreateCart(owner);
    await this.assertItemInCart(cart.id, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    await this.touch(cart.id);
    return this.buildCartResponse(cart.id);
  }

  async clear(owner: CartOwner) {
    const cart = await this.getOrCreateCart(owner);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });
    return this.buildCartResponse(cart.id);
  }

  // ---------------------------------------------------------------- cupom

  async applyCoupon(owner: CartOwner, code: string) {
    const cart = await this.getOrCreateCart(owner);
    const normalized = code.trim().toUpperCase();

    const coupon = await this.prisma.coupon.findFirst({
      where: { code: normalized, isActive: true },
    });

    if (!coupon) {
      throw new NotFoundException(
        "Cupom inexistente. Criatividade nao vale desconto.",
      );
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException(
        "Cupom expirado. O tempo passa para todos.",
      );
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException(
        "Cupom esgotado. Chegou tarde, como sempre.",
      );
    }

    const { totals } = await this.buildCartResponse(cart.id);

    if (totals.subtotalCents < coupon.minSubtotalCents) {
      const faltam = (coupon.minSubtotalCents - totals.subtotalCents) / 100;
      throw new BadRequestException(
        `Esse cupom exige um subtotal maior. Faltam R$ ${faltam.toFixed(2)}.`,
      );
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: coupon.id },
    });

    return this.buildCartResponse(cart.id);
  }

  async removeCoupon(owner: CartOwner) {
    const cart = await this.getOrCreateCart(owner);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });
    return this.buildCartResponse(cart.id);
  }

  // ---------------------------------------------------------------- merge

  /** No login, o carrinho anonimo e absorvido pelo carrinho do usuario. */
  async mergeSessionCartIntoUser(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const sessionCart = await this.prisma.cart.findFirst({
      where: { sessionId },
      include: { items: true },
    });

    if (!sessionCart || sessionCart.items.length === 0) {
      if (sessionCart) {
        await this.prisma.cart.delete({ where: { id: sessionCart.id } });
      }
      return;
    }

    const userCart = await this.getOrCreateCart({ userId });

    for (const item of sessionCart.items) {
      await this.prisma.cartItem.upsert({
        where: {
          cartId_variantId: { cartId: userCart.id, variantId: item.variantId },
        },
        create: {
          cartId: userCart.id,
          variantId: item.variantId,
          quantity: item.quantity,
          customText: item.customText,
        },
        update: { quantity: { increment: item.quantity } },
      });
    }

    if (sessionCart.couponId) {
      await this.prisma.cart.update({
        where: { id: userCart.id },
        data: { couponId: sessionCart.couponId },
      });
    }

    await this.prisma.cart.delete({ where: { id: sessionCart.id } });
  }

  // ---------------------------------------------------------------- calculo

  /** Fonte unica de verdade dos totais. O cliente nunca envia preco. */
  async buildCartResponse(
    cartId: string,
    zipCode?: string,
    method = "economico",
  ) {
    const cart = (await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_INCLUDE,
    })) as CartWithItems;

    const items = cart.items.map((item) => {
      const unitPriceCents = item.variant.priceCents;
      return {
        id: item.id,
        variantId: item.variantId,
        productId: item.variant.product.id,
        productSlug: item.variant.product.slug,
        productName: item.variant.product.name,
        categoryName: item.variant.product.category.name,
        humor: item.variant.product.humor,
        sku: item.variant.sku,
        variantLabel: this.variantLabel(item.variant),
        imageUrl:
          (
            item.variant.product.images.find((image) => image.color && image.color === item.variant.color) ??
            item.variant.product.images[0]
          )?.url ?? null,
        unitPriceCents,
        quantity: item.quantity,
        totalCents: unitPriceCents * item.quantity,
        weightGrams: item.variant.weightGrams * item.quantity,
        customText: item.customText,
      };
    });

    const subtotalCents = items.reduce((acc, i) => acc + i.totalCents, 0);
    const weightGrams = items.reduce((acc, i) => acc + i.weightGrams, 0);
    const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

    const coupon = cart.coupon;
    let discountCents = 0;
    let freeShipping = false;

    if (coupon && subtotalCents >= coupon.minSubtotalCents) {
      if (coupon.type === CouponType.PERCENT) {
        discountCents = Math.floor((subtotalCents * coupon.value) / 100);
      } else if (coupon.type === CouponType.FIXED) {
        discountCents = Math.min(coupon.value, subtotalCents);
      } else {
        freeShipping = true;
      }
    }

    let shippingOptions: ShippingOption[] = [];
    let shippingCents = 0;
    let selectedShipping: ShippingOption | null = null;

    if (zipCode && itemCount > 0) {
      shippingOptions = await this.shipping.quote(
        zipCode,
        weightGrams,
        subtotalCents - discountCents,
      );
      selectedShipping =
        shippingOptions.find((o) => o.method === method) ?? shippingOptions[0];
      shippingCents = freeShipping ? 0 : selectedShipping.priceCents;
      if (freeShipping) {
        selectedShipping = { ...selectedShipping, priceCents: 0 };
        shippingOptions = shippingOptions.map((o) => ({ ...o, priceCents: 0 }));
      }
    }

    const totals: CartTotals = {
      subtotalCents,
      discountCents,
      shippingCents,
      totalCents: Math.max(0, subtotalCents - discountCents + shippingCents),
      weightGrams,
      itemCount,
    };

    const threshold = this.shipping.freeShippingThresholdCents;

    return {
      id: cart.id,
      items,
      totals,
      coupon: coupon
        ? {
            code: coupon.code,
            description: coupon.description,
            type: coupon.type,
            value: coupon.value,
          }
        : null,
      shipping: {
        zipCode: zipCode ?? null,
        selected: selectedShipping,
        options: shippingOptions,
        freeShippingThresholdCents: threshold,
        missingForFreeShippingCents: Math.max(0, threshold - subtotalCents),
      },
      isEmpty: itemCount === 0,
    };
  }

  variantLabel(variant: {
    size?: string | null;
    color?: string | null;
    model?: string | null;
  }) {
    return (
      [variant.size, variant.color, variant.model]
        .filter(Boolean)
        .join(" · ") || "Padrão"
    );
  }

  private async touch(cartId: string) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });
  }

  private async assertItemInCart(cartId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException("Esse item nao esta no seu carrinho.");
    }
  }
}
