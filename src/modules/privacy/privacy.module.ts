import { Global, Module } from "@nestjs/common";
import { ConsentService } from "./consent.service";
import { PrivacyController } from "./privacy.controller";

@Global()
@Module({
  controllers: [PrivacyController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class PrivacyModule {}
