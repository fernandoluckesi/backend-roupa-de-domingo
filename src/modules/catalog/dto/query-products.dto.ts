import { ApiPropertyOptional } from "@nestjs/swagger";
import { Humor } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class QueryProductsDto {
  @ApiPropertyOptional({ description: "Slug da categoria" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: Humor })
  @IsOptional()
  @IsEnum(Humor)
  humor?: Humor;

  @ApiPropertyOptional({ description: "Busca em nome, descricao e tags" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Tags separadas por virgula" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ description: "Preco minimo em centavos" })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: "Preco maximo em centavos" })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: ["recentes", "preco-asc", "preco-desc", "populares", "nome"],
    default: "recentes",
  })
  @IsOptional()
  @IsIn(["recentes", "preco-asc", "preco-desc", "populares", "nome"])
  sort?: "recentes" | "preco-asc" | "preco-desc" | "populares" | "nome";

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 12, maximum: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;

  @ApiPropertyOptional({
    description:
      "Inclui produtos secretos. Só tem efeito para quem descobriu easter eggs suficientes.",
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  includeSecret?: boolean;
}
