import { Body, Controller, Get, HttpCode, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { SessionId } from "../../common/decorators/current-user.decorator";
import { AdminOnly } from "../../common/guards/admin-auth.guard";
import { AnalyticsReportsService } from "./analytics-reports.service";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsRangeDto, CollectDto, PathsQueryDto } from "./dto/analytics.dto";

@ApiTags("analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post("collect")
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Coleta da loja: pagina vista, tempo na pagina e eventos (sem cookie e sem dado pessoal)" })
  collect(@Body() dto: CollectDto, @SessionId() sessionId: string | undefined, @Req() req: Request) {
    return this.analytics.collect(dto, {
      sessionId,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      headers: req.headers as Record<string, unknown>,
    });
  }
}

@ApiTags("admin-analytics")
@AdminOnly()
@Controller("admin/analytics")
export class AdminAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly reports: AnalyticsReportsService,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "Resumo: usuarios, sessoes, engajamento e vendas, com o periodo anterior" })
  overview(@Query() dto: AnalyticsRangeDto) {
    return this.reports.overview(dto);
  }

  @Get("realtime")
  @ApiOperation({ summary: "Usuarios ativos nos ultimos 30 minutos" })
  realtime() {
    return this.reports.realtime();
  }

  @Get("summary")
  @ApiOperation({ summary: "Aquisicao: QR Code, redes sociais e campanhas, com vendas por origem" })
  summary(@Query() dto: AnalyticsRangeDto) {
    return this.analytics.summary(dto);
  }

  @Get("pages")
  @ApiOperation({ summary: "Engajamento: paginas, paginas de entrada, buscas no site e eventos" })
  pages(@Query() dto: PathsQueryDto) {
    return this.reports.pages(dto);
  }

  @Get("paths")
  @ApiOperation({ summary: "Exploracao de caminhos dentro do site" })
  paths(@Query() dto: PathsQueryDto) {
    return this.reports.paths(dto);
  }

  @Get("audience")
  @ApiOperation({ summary: "Usuarios: local (pais, estado, cidade) e tecnologia" })
  audience(@Query() dto: AnalyticsRangeDto) {
    return this.reports.audience(dto);
  }

  @Get("funnel")
  @ApiOperation({ summary: "Funil de compra e produtos" })
  funnel(@Query() dto: AnalyticsRangeDto) {
    return this.reports.funnel(dto);
  }
}
