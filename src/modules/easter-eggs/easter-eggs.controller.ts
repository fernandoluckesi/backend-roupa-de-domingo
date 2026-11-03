import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { EasterEggsService } from "./easter-eggs.service";
import { OptionalJwtGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  SessionId,
} from "../../common/decorators/current-user.decorator";

@ApiTags("easter-eggs")
@UseGuards(OptionalJwtGuard)
@Controller("easter-eggs")
export class EasterEggsController {
  constructor(private readonly service: EasterEggsService) {}

  @Get()
  @ApiOperation({
    summary: "Catalogo de easter eggs (mensagem so dos descobertos)",
  })
  list(@CurrentUser("id") userId?: string, @SessionId() sessionId?: string) {
    return this.service.list({ userId, sessionId });
  }

  @Get("progress")
  @ApiOperation({ summary: "Progresso e ranking de descobertas" })
  progress(
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.service.progress({ userId, sessionId });
  }

  @Post(":code/discover")
  @HttpCode(200)
  @ApiOperation({
    summary: "Registra a descoberta de um easter egg (idempotente)",
  })
  discover(
    @Param("code") code: string,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    return this.service.discover(code.toUpperCase(), { userId, sessionId });
  }
}
