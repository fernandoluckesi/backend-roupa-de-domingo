import { Body, Controller, Post } from "@nestjs/common";
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Matches, Min } from "class-validator";
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
}

@ApiTags("shipping")
@Controller("shipping")
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post("quote")
  @ApiOperation({ summary: "Cota frete por CEP e peso" })
  quote(@Body() dto: QuoteShippingDto) {
    return {
      zipCode: dto.zipCode,
      freeShippingThresholdCents: this.shipping.freeShippingThresholdCents,
      options: this.shipping.quote(
        dto.zipCode,
        dto.weightGrams ?? 300,
        dto.subtotalCents ?? 0,
      ),
    };
  }
}
