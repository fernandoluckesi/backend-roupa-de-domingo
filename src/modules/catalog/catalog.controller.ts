import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import { QueryProductsDto } from "./dto/query-products.dto";
import { CreateProductDto, UpdateProductDto } from "./dto/upsert-product.dto";
import {
  OptionalJwtGuard,
} from "../../common/guards/jwt-auth.guard";
import { AdminOnly } from "../../common/guards/admin-auth.guard";
import {
  CurrentUser,
  SessionId,
} from "../../common/decorators/current-user.decorator";
import { EasterEggsService } from "../easter-eggs/easter-eggs.service";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly easterEggs: EasterEggsService,
  ) {}

  @Get("products")
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: "Lista produtos com filtros e paginacao" })
  async list(
    @Query() query: QueryProductsDto,
    @CurrentUser("id") userId?: string,
    @SessionId() sessionId?: string,
  ) {
    const discovered = query.includeSecret
      ? await this.easterEggs.countDiscoveries({ userId, sessionId })
      : 0;
    return this.catalog.findMany(query, discovered);
  }

  @Get("products/featured")
  @ApiOperation({ summary: "Vitrine da home" })
  featured() {
    return this.catalog.findFeatured();
  }

  @Get("products/:slug")
  @ApiOperation({ summary: "Detalhe do produto por slug" })
  bySlug(@Param("slug") slug: string) {
    return this.catalog.findBySlug(slug);
  }

  @Get("categories")
  @ApiOperation({ summary: "Lista categorias" })
  categories() {
    return this.catalog.listCategories();
  }

  @Get("humors")
  @ApiOperation({ summary: "Lista os eixos de humor usados como filtro" })
  humors() {
    return this.catalog.listHumors();
  }

  @Get("genders")
  @ApiOperation({ summary: "Lista os publicos-alvo usados como filtro" })
  genders() {
    return this.catalog.listGenders();
  }

  // ------------------------------------------------------------ admin

  @Post("admin/products")
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "[admin] Cria produto" })
  create(@Body() dto: CreateProductDto) {
    return this.catalog.create(dto);
  }

  @Patch("admin/products/:id")
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "[admin] Atualiza produto" })
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.catalog.update(id, dto);
  }

  @Delete("admin/products/:id")
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "[admin] Arquiva produto" })
  remove(@Param("id") id: string) {
    return this.catalog.remove(id);
  }
}
