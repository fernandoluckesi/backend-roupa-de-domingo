import { Global, Injectable, Logger, Module } from "@nestjs/common";
import { AuditCategory, AuditOutcome, InvoiceStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

/**
 * Nota fiscal por pedido.
 *
 * Driver "mock" (unico disponivel): registra a nota com numeracao interna
 * "MOCK-<serie>-<n>" e status ISSUED para o fluxo ponta a ponta funcionar
 * (pedido -> nota -> e-mail -> tela do pedido). NAO e uma NF-e valida: para
 * emitir de verdade e preciso CNPJ real, certificado A1 e um emissor
 * (ex.: Focus NFe, eNotas, NFE.io) — ver docs/CONFORMIDADE-JURIDICO-SEGURANCA-SEO.md.
 *
 * Tributos aproximados (Lei 12.741/2012): calculados so se INVOICE_APPROX_TAX_PERCENT
 * estiver definido (percentual da tabela IBPT indicado pela contabilidade).
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  private get approxTaxPercent(): number | null {
    const raw = process.env.INVOICE_APPROX_TAX_PERCENT;
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /** Idempotente: um pedido tem no maximo uma nota. */
  async issueForOrder(orderId: string) {
    const existing = await this.prisma.invoice.findUnique({ where: { orderId } });
    if (existing && existing.status === InvoiceStatus.ISSUED) return existing;

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    try {
      const sequence = (await this.prisma.invoice.count({ where: { status: InvoiceStatus.ISSUED } })) + 1;
      const series = "1";
      const number = `MOCK-${series}-${String(sequence).padStart(6, "0")}`;
      const percent = this.approxTaxPercent;

      const invoice = await this.prisma.invoice.upsert({
        where: { orderId },
        create: {
          orderId,
          provider: "mock",
          status: InvoiceStatus.ISSUED,
          number,
          series,
          approxTaxCents: percent ? Math.round((order.totalCents * percent) / 100) : null,
          issuedAt: new Date(),
        },
        update: {
          status: InvoiceStatus.ISSUED,
          number,
          series,
          lastError: null,
          issuedAt: new Date(),
        },
      });

      this.audit.record({
        category: AuditCategory.INVOICE,
        action: "invoice.issued",
        target: { type: "order", id: order.number },
        data: { provider: "mock", invoiceNumber: number, series, totalCents: order.totalCents, approxTaxCents: invoice.approxTaxCents },
      });
      void this.mail.sendInvoice(order.customerEmail, order.customerName, order.number, invoice);
      this.logger.log(`Nota ${number} registrada para ${order.number} (driver mock, sem validade fiscal).`);
      return invoice;
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Falha ao emitir nota de ${order.number}: ${message}`);
      this.audit.record({
        category: AuditCategory.INVOICE,
        action: "invoice.failed",
        outcome: AuditOutcome.FAILURE,
        target: { type: "order", id: order.number },
        data: { provider: "mock", error: message.slice(0, 300) },
      });
      return this.prisma.invoice.upsert({
        where: { orderId },
        create: { orderId, provider: "mock", status: InvoiceStatus.ERROR, lastError: message },
        update: { status: InvoiceStatus.ERROR, lastError: message },
      });
    }
  }
}

@Global()
@Module({
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
