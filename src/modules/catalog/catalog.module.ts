import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { EasterEggsModule } from "../easter-eggs/easter-eggs.module";

@Module({
  imports: [EasterEggsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
