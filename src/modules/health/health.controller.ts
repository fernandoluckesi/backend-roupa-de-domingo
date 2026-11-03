import { Controller, Get, HttpCode } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  @ApiOperation({ summary: "Verifica API e banco" })
  async health() {
    let database = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }
    return {
      status: database === "up" ? "ok" : "degraded",
      service: "backend-roupa-de-domingo",
      database,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Easter egg de backend: RFC 2324. */
  @Get("teapot")
  @HttpCode(418)
  @ApiOperation({ summary: "Nao faz cafe" })
  teapot() {
    return {
      statusCode: 418,
      message: "Sou um bule. Nao faco cafe, nem milagre.",
      sugestao: "Mas vendemos uma caneca que combina com sua frustracao.",
      produto: "/api/products/caneca-primeiro-cafe",
    };
  }
}
