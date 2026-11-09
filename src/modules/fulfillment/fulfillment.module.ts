import { Module } from "@nestjs/common";
import { FulfillmentService } from "./fulfillment.service";

/** Operacao propria: fila de producao, embalagem e postagem (Correios). */
@Module({
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
