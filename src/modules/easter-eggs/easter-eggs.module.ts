import { Module } from "@nestjs/common";
import { EasterEggsController } from "./easter-eggs.controller";
import { EasterEggsService } from "./easter-eggs.service";

@Module({
  controllers: [EasterEggsController],
  providers: [EasterEggsService],
  exports: [EasterEggsService],
})
export class EasterEggsModule {}
