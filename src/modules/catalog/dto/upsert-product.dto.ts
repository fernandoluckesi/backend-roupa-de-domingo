import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Gender, Humor } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from "class-validator";

export class VariantInputDto {
  @ApiProperty()
  @IsString()
  @Length(2, 60)
  sku: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({ description: "Preco em centavos" })
  @IsInt()
  @Min(1)
  priceCents: number;

  @ApiPropertyOptional({ default: 300 })
  @IsOptional()
  @IsInt()
  @Min(1)
  weightGrams?: number;
}

export class ImageInputDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty()
  @IsString()
  alt: string;

  @ApiPropertyOptional({ description: "Cor da variante mostrada na foto" })
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @Length(3, 160)
  name: string;

  @ApiProperty()
  @IsString()
  @Length(5, 240)
  shortDescription: string;

  @ApiProperty()
  @IsString()
  @Length(10, 4000)
  description: string;

  @ApiProperty({ enum: Humor })
  @IsEnum(Humor)
  humor: Humor;

  @ApiPropertyOptional({
    enum: Gender,
    default: Gender.UNISSEX,
    description: "Publico-alvo. UNISSEX aparece em todos os filtros de genero.",
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ description: "Preco base em centavos" })
  @IsInt()
  @Min(1)
  basePriceCents: number;

  @ApiProperty({ description: "Slug da categoria" })
  @IsString()
  categorySlug: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @ApiProperty({ type: [VariantInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants: VariantInputDto[];

  @ApiPropertyOptional({ type: [ImageInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  images?: ImageInputDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
