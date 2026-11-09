import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { FulfillmentStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsEnum,
} from "class-validator";

export const ORDER_STAGES = [
  "awaiting_payment",
  "to_produce",
  "in_production",
  "packed",
  "shipped",
  "delivered",
  "issues",
  "all",
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ enum: ORDER_STAGES, default: "all" })
  @IsOptional()
  @IsIn(ORDER_STAGES)
  stage?: OrderStage;

  @ApiPropertyOptional({ description: "Numero do pedido, nome ou e-mail do cliente" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: "Criado a partir de (ISO 8601)" })
  @IsOptional()
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: "Criado ate (ISO 8601)" })
  @IsOptional()
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ProductionListQueryDto {
  @ApiPropertyOptional({ enum: ["to_produce", "in_production"], default: "to_produce" })
  @IsOptional()
  @IsIn(["to_produce", "in_production"])
  stage?: "to_produce" | "in_production";
}

export class UpdateFulfillmentDto {
  @ApiPropertyOptional({ enum: FulfillmentStatus })
  @IsOptional()
  @IsEnum(FulfillmentStatus)
  status?: FulfillmentStatus;

  @ApiPropertyOptional({ example: "AB123456789BR" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  trackingCode?: string;

  @ApiPropertyOptional({ enum: ["PAC", "SEDEX"] })
  @IsOptional()
  @IsIn(["PAC", "SEDEX"])
  serviceCode?: "PAC" | "SEDEX";

  @ApiPropertyOptional({ description: "Peso do pacote em gramas" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30_000)
  packageWeightGrams?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  packageLengthCm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  packageWidthCm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  packageHeightCm?: number | null;

  @ApiPropertyOptional({ description: "Anotacao interna (o cliente nao ve)" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string | null;

  @ApiPropertyOptional({ description: "Mensagem extra na timeline do pedido (o cliente ve)" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PrintLabelsDto {
  @ApiProperty({ type: [String], example: ["RD-5YCFQP"] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => String(v).trim().toUpperCase()) : value))
  numbers: string[];
}
