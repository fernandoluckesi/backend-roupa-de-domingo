import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FulfillmentController } from "./fulfillment.controller";
import { FulfillmentService } from "./fulfillment.service";
import { PRINT_PROVIDER } from "./providers/print-provider.interface";
import { MockPrintProvider } from "./providers/mock-print.provider";
import { HttpPrintProvider } from "./providers/http-print.provider";

@Module({
  controllers: [FulfillmentController],
  providers: [
    MockPrintProvider,
    HttpPrintProvider,
    {
      provide: PRINT_PROVIDER,
      inject: [ConfigService, MockPrintProvider, HttpPrintProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPrintProvider,
        http: HttpPrintProvider,
      ) => {
        const driver = config.get<string>("print.provider", "mock");
        const apiUrl = config.get<string>("print.apiUrl", "");
        // Sem URL configurada o driver http nao tem para onde chamar
        return driver === "http" && apiUrl ? http : mock;
      },
    },
    FulfillmentService,
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
