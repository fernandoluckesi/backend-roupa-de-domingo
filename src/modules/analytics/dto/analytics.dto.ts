import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export const EVENT_NAMES = ["view_item", "add_to_cart", "begin_checkout", "search"] as const;

/**
 * Coleta da loja (como o "collect" do Google Analytics), sem nada que identifique a pessoa:
 * - page_view: pagina vista (com a origem na primeira pagina da visita)
 * - engagement: tempo em que a pagina ficou visivel
 * - event: produto visto, carrinho, checkout, busca
 */
export class CollectDto {
  @ApiProperty({ enum: ["page_view", "engagement", "event"] })
  @IsIn(["page_view", "engagement", "event"])
  type: "page_view" | "engagement" | "event";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: "390x844" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  screen?: string;

  @ApiPropertyOptional({ example: "pt-BR" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @ApiPropertyOptional({ description: "A pessoa recusou Estatisticas: conta so a origem da visita" })
  @IsOptional()
  @IsBoolean()
  minimal?: boolean;

  @ApiPropertyOptional({ description: "engagement: pagina vista a que o tempo se refere" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pageviewId?: string;

  @ApiPropertyOptional({ description: "engagement: milissegundos com a pagina visivel desde o ultimo envio" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30 * 60_000)
  ms?: number;

  @ApiPropertyOptional({ enum: EVENT_NAMES })
  @IsOptional()
  @IsIn(EVENT_NAMES)
  name?: (typeof EVENT_NAMES)[number];

  @ApiPropertyOptional({ description: "event: produto (slug) ou termo buscado" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  valueCents?: number;


  @ApiPropertyOptional({ example: "/segredo", description: "page_view: pagina vista; event: onde aconteceu" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;

  @ApiPropertyOptional({ description: "document.referrer (so o dominio e guardado)" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;

  @ApiPropertyOptional({ example: "instagram" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmSource?: string;

  @ApiPropertyOptional({ example: "stories" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  utmMedium?: string;

  @ApiPropertyOptional({ example: "lancamento-dezembro" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmContent?: string;

  @ApiPropertyOptional({ description: "Onde o QR Code esta impresso (?q=costas)" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  qr?: string;

  @ApiPropertyOptional({ description: "Havia fbclid / gclid / ttclid na URL (o valor nao e enviado)" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  clickId?: "fb" | "google" | "tiktok";
}

export class AnalyticsRangeDto {
  @ApiPropertyOptional({ example: "2026-11-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-11-30", description: "Inclusivo" })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class PathsQueryDto extends AnalyticsRangeDto {
  @ApiPropertyOptional({ description: "Pagina de partida (vazio = inicio da sessao)" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  start?: string;

  @ApiPropertyOptional({ description: "Agrupa /produto/* e similares" })
  @IsOptional()
  @IsIn(["true", "false"])
  group?: "true" | "false";
}
