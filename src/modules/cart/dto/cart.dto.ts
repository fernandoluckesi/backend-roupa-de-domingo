import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class AddCartItemDto {
  @ApiProperty({ description: "Id da variante (tamanho/cor/modelo)" })
  @IsString()
  variantId: string;

  @ApiPropertyOptional({ default: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class ApplyCouponDto {
  @ApiProperty({ example: "DOMINGO10" })
  @IsString()
  @MaxLength(40)
  code: string;
}

export class CartShippingDto {
  @ApiPropertyOptional({ example: "01310100" })
  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: "CEP invalido." })
  zipCode?: string;

  @ApiPropertyOptional({ enum: ["economico", "expresso"] })
  @IsOptional()
  @IsString()
  method?: string;
}
