import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import type { Request } from "express";
import { ConsentService } from "./consent.service";
import { OptionalJwtGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

class CookieConsentDto {
  @ApiProperty({ example: "2026-11-04" })
  @IsString()
  @MaxLength(20)
  version: string;

  @ApiProperty()
  @IsBoolean()
  preferences: boolean;

  @ApiProperty()
  @IsBoolean()
  statistics: boolean;

  @ApiProperty()
  @IsBoolean()
  marketing: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sessionId?: string;
}

@ApiTags("privacy")
@Controller("privacy")
export class PrivacyController {
  constructor(private readonly consents: ConsentService) {}

  @Post("consents/cookies")
  @HttpCode(201)
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Registra a escolha do banner de cookies (versao + categorias)" })
  async recordCookies(@Body() dto: CookieConsentDto, @CurrentUser("id") userId: string | undefined, @Req() req: Request) {
    await this.consents.record({
      userId,
      sessionId: dto.sessionId,
      kind: "cookies",
      version: dto.version,
      granted: dto.preferences || dto.statistics || dto.marketing,
      details: { preferences: dto.preferences, statistics: dto.statistics, marketing: dto.marketing },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return { recorded: true };
  }
}
