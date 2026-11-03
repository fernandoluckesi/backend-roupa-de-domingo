import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CartService } from "./cart.service";
import {
  AddCartItemDto,
  ApplyCouponDto,
  CartShippingDto,
  UpdateCartItemDto,
} from "./dto/cart.dto";
import { OptionalJwtGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  SessionId,
} from "../../common/decorators/current-user.decorator";

@ApiTags("cart")
@UseGuards(OptionalJwtGuard)
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: "Carrinho atual com totais calculados no servidor" })
  get(
    @Query() query: CartShippingDto,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.cart.getCart(
      { userId, sessionId },
      query.zipCode,
      query.method ?? "economico",
    );
  }

  @Post("items")
  @ApiOperation({ summary: "Adiciona item" })
  addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.cart.addItem({ userId, sessionId }, dto);
  }

  @Patch("items/:id")
  @ApiOperation({ summary: "Atualiza quantidade ou texto do item" })
  updateItem(
    @Param("id") id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.cart.updateItem({ userId, sessionId }, id, dto);
  }

  @Delete("items/:id")
  @ApiOperation({ summary: "Remove item" })
  removeItem(
    @Param("id") id: string,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.cart.removeItem({ userId, sessionId }, id);
  }

  @Delete()
  @ApiOperation({ summary: "Esvazia o carrinho" })
  clear(@CurrentUser("id") userId?: string, @SessionId() sessionId?: string) {
    return this.cart.clear({ userId, sessionId });
  }

  @Post("coupon")
  @ApiOperation({ summary: "Aplica cupom" })
  applyCoupon(
    @Body() dto: ApplyCouponDto,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.cart.applyCoupon({ userId, sessionId }, dto.code);
  }

  @Delete("coupon")
  @ApiOperation({ summary: "Remove cupom" })
  removeCoupon(
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.cart.removeCoupon({ userId, sessionId });
  }
}
