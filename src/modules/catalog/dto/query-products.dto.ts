import { ApiPropertyOptional } from "@nestjs/swagger";
import { Gender, Humor } from "@prisma/client";
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

/** "a,b" ou ["a","b"] -> ["a","b"] (filtros de multipla escolha) */
const toList = ({ value }: { value: unknown }) =>
  (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((item) => String(item).trim())
    .filter(Boolean);

export class QueryProductsDto {
  @ApiPropertyOptional({ description: "Slugs de categoria separados por virgula (qualquer um deles)" })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @ApiPropertyOptional({ description: "Tipos de humor separados por virgula (qualquer um deles)", enum: Humor, isArray: true })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsEnum(Humor, { each: true })
  humor?: Humor[];

  @ApiPropertyOptional({
    description:
      "Publico-alvo separado por virgula. MASCULINO e FEMININO incluem as pecas UNISSEX automaticamente.",
    enum: Gender,
    isArray: true,
  })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender?: Gender[];

  @ApiPropertyOptional({
    description:
      "Busca por relevancia em nome, subtitulo, tags e descricao: ignora acento e maiusculas, aceita palavras em qualquer ordem, palavra incompleta e erro de digitacao",
  })
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
    description: "relevancia so faz sentido com busca (e o padrao quando ha busca); sem busca vale recentes",
    enum: ["relevancia", "recentes", "preco-asc", "preco-desc", "populares", "nome"],
  })
  @IsOptional()
  @IsIn(["relevancia", "recentes", "preco-asc", "preco-desc", "populares", "nome"])
  sort?: "relevancia" | "recentes" | "preco-asc" | "preco-desc" | "populares" | "nome";

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
