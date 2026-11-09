import { Body, Controller, NotFoundException, Post } from "@nestjs/common";
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { ShippingService } from "./shipping.service";

class QuoteShippingDto {
  @ApiProperty({ example: "01310100" })
  @Matches(/^\d{5}-?\d{3}$/, { message: "CEP invalido." })
  zipCode: string;

  @ApiPropertyOptional({ description: "Peso total em gramas", default: 300 })
  @IsOptional()
  @IsInt()
  @Min(1)
  weightGrams?: number;

  @ApiPropertyOptional({
    description: "Subtotal em centavos (para frete gratis)",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  subtotalCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cartId?: string;

  @ApiPropertyOptional({
    description:
      "Variante do produto (pagina de produto). Com ela, peso e subtotal vem do catalogo",
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

@ApiTags("shipping")
@Controller("shipping")
export class ShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("quote")
  @ApiOperation({
    summary:
      "Cota frete por CEP (Correios, tabela por regiao). Com variantId usa peso e preco do catalogo",
  })
  async quote(@Body() dto: QuoteShippingDto) {
    let weightGrams = dto.weightGrams ?? 300;
    let subtotalCents = dto.subtotalCents ?? 0;

    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
        select: { priceCents: true, weightGrams: true },
      });
      if (!variant) throw new NotFoundException("Variante nao encontrada.");
      const quantity = dto.quantity ?? 1;
      weightGrams = variant.weightGrams * quantity;
      subtotalCents = variant.priceCents * quantity;
    }

    return {
      zipCode: dto.zipCode,
      freeShippingThresholdCents: this.shipping.freeShippingThresholdCents,
      options: await this.shipping.quote(
        dto.zipCode,
        weightGrams,
        subtotalCents,
      ),
    };
  }
}
