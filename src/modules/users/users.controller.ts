import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { AddressDto, UpdateProfileDto } from "./dto/users.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
