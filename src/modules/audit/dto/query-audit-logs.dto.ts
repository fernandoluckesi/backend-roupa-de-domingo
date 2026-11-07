import { ApiPropertyOptional } from "@nestjs/swagger";
import { AuditActorType, AuditCategory, AuditOutcome } from "@prisma/client";
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class QueryAuditLogsDto {
  @ApiPropertyOptional({ enum: AuditCategory })
  @IsOptional()
  @IsEnum(AuditCategory)
  category?: AuditCategory;

  @ApiPropertyOptional({ description: "Prefixo da acao, ex.: auth.login ou order." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ enum: AuditOutcome })
  @IsOptional()
  @IsEnum(AuditOutcome)
  outcome?: AuditOutcome;

  @ApiPropertyOptional({ enum: AuditActorType })
  @IsOptional()
  @IsEnum(AuditActorType)
  actorType?: AuditActorType;

  @ApiPropertyOptional({ description: "Id do usuario que fez a acao" })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: "Tipo do alvo: user, order, payment, return, invoice..." })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: "Id do alvo (ex.: id ou numero do pedido)" })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: "Id da requisicao (cabecalho X-Request-Id)" })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: "Data inicial (ISO 8601)" })
  @IsOptional()
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: "Data final (ISO 8601)" })
  @IsOptional()
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
