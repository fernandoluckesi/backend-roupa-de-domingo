import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import {
  AddressDto,
  DeleteAccountDto,
  MarketingConsentDto,
  UpdateProfileDto,
} from "./dto/users.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Get("me/export")
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: "Exporta todos os dados da conta em JSON (LGPD art. 18, II e V)" })
  exportData(@CurrentUser("id") userId: string, @Res({ passthrough: true }) res: Response) {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="meus-dados-roupa-de-domingo-${date}.json"`);
    return this.users.exportData(userId);
  }

  @Get("me/sharing")
  @ApiOperation({ summary: "Com quem os dados sao compartilhados (LGPD art. 18, VII)" })
  sharing() {
    return this.users.sharing();
  }

  @Patch("me/consents")
  @ApiOperation({ summary: "Concede ou revoga o consentimento de marketing" })
  setConsents(@CurrentUser("id") userId: string, @Body() dto: MarketingConsentDto, @Req() req: Request) {
    return this.users.setMarketingConsent(userId, dto.marketingOptIn, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @Delete("me")
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: "Exclui a conta e anonimiza os dados pessoais (LGPD art. 18, VI)" })
  async deleteAccount(
    @CurrentUser("id") userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.users.deleteAccount(userId, dto);
    res.clearCookie(this.config.get<string>("security.sessionCookie", "rd_session"), { path: "/" });
    return result;
  }

  @Patch("me")
  @ApiOperation({ summary: "Atualiza o perfil" })
  updateProfile(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  @Get("me/addresses")
  @ApiOperation({ summary: "Lista enderecos" })
  listAddresses(@CurrentUser("id") userId: string) {
    return this.users.listAddresses(userId);
  }

  @Post("me/addresses")
  @ApiOperation({ summary: "Cria endereco" })
  createAddress(@CurrentUser("id") userId: string, @Body() dto: AddressDto) {
    return this.users.createAddress(userId, dto);
  }

  @Put("me/addresses/:id")
  @ApiOperation({ summary: "Atualiza endereco" })
  updateAddress(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: AddressDto,
  ) {
    return this.users.updateAddress(userId, id, dto);
  }

  @Delete("me/addresses/:id")
  @ApiOperation({ summary: "Remove endereco" })
  removeAddress(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.users.removeAddress(userId, id);
  }
}
