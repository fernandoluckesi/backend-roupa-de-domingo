import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Cria conta e devolve token" })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Autentica e devolve token" })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Dados do usuario autenticado" })
  me(@CurrentUser("id") userId: string) {
    return this.auth.me(userId);
  }
}
