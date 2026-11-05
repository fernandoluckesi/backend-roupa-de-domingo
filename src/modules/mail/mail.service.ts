import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { maskEmail } from "../../common/utils/privacy.util";
import { formatBRL } from "../../common/utils/money.util";

export interface MailMessage {
  to: string;
  subject: string;
  /** Texto puro; o HTML e gerado a partir dele */
  text: string;
  replyTo?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * E-mails transacionais. Driver "log" (padrao em dev) so registra no console,
 * com destinatario mascarado; "smtp" envia de verdade (MAIL_DRIVER=smtp + SMTP_*).
 * Falha de envio nunca derruba a operacao principal (pedido, cadastro...).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    if (this.config.get("mail.driver") === "smtp") {
      const smtp = this.config.get("mail.smtp");
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
    }
  }

  get frontendUrl(): string {
    return this.config.get<string>("frontendUrl", "http://localhost:5173").replace(/\/$/, "");
  }

  async send(message: MailMessage): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.logger.log(
          `[mail:log] para ${maskEmail(message.to)} | ${message.subject}\n${message.text}`,
        );
        return true;
      }
      await this.transporter.sendMail({
        from: this.config.get<string>("mail.from"),
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: this.toHtml(message.text),
      });
      return true;
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail para ${maskEmail(message.to)}: ${(error as Error).message}`);
      return false;
    }
  }

  private toHtml(text: string): string {
    const body = escapeHtml(text)
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
      .replace(/\n/g, "<br>");
    return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px">${body}</div>`;
  }

  // ---------------------------------------------------------------- modelos

  private footer(): string {
    return [
      "",
      "—",
      "Roupa de Domingo · estampas sem anestesia",
      `Termos de uso: ${this.frontendUrl}/termos`,
      `Trocas e devoluções: ${this.frontendUrl}/trocas-e-devolucoes`,
      `Privacidade: ${this.frontendUrl}/privacidade`,
      "Este é um e-mail transacional sobre a sua conta ou pedido.",
    ].join("\n");
  }

  sendEmailVerification(to: string, name: string, token: string) {
    return this.send({
      to,
      subject: "Confirme seu e-mail na Roupa de Domingo",
      text: [
        `Oi, ${name}.`,
        "",
        "Confirme que este e-mail é seu clicando no link abaixo (vale por 48 horas):",
        `${this.frontendUrl}/verificar-email?token=${encodeURIComponent(token)}`,
        "",
        "Se não foi você que criou a conta, ignore esta mensagem.",
        this.footer(),
      ].join("\n"),
    });
  }

  sendPasswordReset(to: string, name: string, token: string) {
    return this.send({
      to,
      subject: "Redefinição de senha",
      text: [
        `Oi, ${name}.`,
        "",
        "Recebemos um pedido para redefinir a sua senha. O link vale por 1 hora e só pode ser usado uma vez:",
        `${this.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`,
        "",
        "Se não foi você, ignore este e-mail: a sua senha continua a mesma.",
        this.footer(),
      ].join("\n"),
    });
  }

  sendPasswordChanged(to: string, name: string) {
    return this.send({
      to,
      subject: "Sua senha foi alterada",
      text: [
        `Oi, ${name}.`,
        "",
        "A senha da sua conta acabou de ser alterada e todas as sessões abertas foram encerradas.",
        `Se não foi você, redefina a senha agora: ${this.frontendUrl}/esqueci-a-senha e fale com o SAC: ${this.frontendUrl}/contato`,
        this.footer(),
      ].join("\n"),
    });
  }

  sendOrderConfirmation(order: {
    number: string;
    customerName: string;
    customerEmail: string;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    totalCents: number;
    estimatedDays: number;
    shippingMethod: string;
    shippingStreet: string;
    shippingNumber: string;
    shippingCity: string;
    shippingState: string;
    items: { productName: string; variantLabel: string; quantity: number; totalCents: number }[];
  }) {
    const lines = order.items.map(
      (i) => `• ${i.quantity}x ${i.productName} (${i.variantLabel}) — ${formatBRL(i.totalCents)}`,
    );
    return this.send({
      to: order.customerEmail,
      subject: `Pedido ${order.number} recebido`,
      text: [
        `Oi, ${order.customerName}.`,
        "",
        `Recebemos o seu pedido ${order.number}. Ele entra em produção assim que o pagamento for confirmado.`,
        "",
        "Itens:",
        ...lines,
        "",
        `Subtotal: ${formatBRL(order.subtotalCents)}`,
        `Desconto: ${formatBRL(order.discountCents)}`,
        `Frete (${order.shippingMethod}): ${formatBRL(order.shippingCents)}`,
        `Total: ${formatBRL(order.totalCents)}`,
        "",
        `Entrega em: ${order.shippingStreet}, ${order.shippingNumber} — ${order.shippingCity}/${order.shippingState}`,
        `Prazo estimado: até ${order.estimatedDays} dias (produção sob demanda + transporte).`,
        "",
        `Acompanhe o pedido: ${this.frontendUrl}/conta/pedidos/${order.number}`,
        "",
        "Direito de arrependimento: você pode desistir da compra em até 7 dias corridos do recebimento,",
        `com devolução integral, inclusive do frete. Como fazer: ${this.frontendUrl}/trocas-e-devolucoes`,
        "",
        "Guarde este e-mail: ele resume o contrato da sua compra. Os termos vigentes estão em",
        `${this.frontendUrl}/termos (versão para imprimir/salvar em PDF na própria página).`,
        this.footer(),
      ].join("\n"),
    });
  }

  sendPaymentApproved(to: string, name: string, orderNumber: string) {
    return this.send({
      to,
      subject: `Pagamento aprovado: pedido ${orderNumber}`,
      text: [
        `Oi, ${name}.`,
        "",
        `O pagamento do pedido ${orderNumber} foi aprovado. Agora ele vai para a produção.`,
        `Acompanhe: ${this.frontendUrl}/conta/pedidos/${orderNumber}`,
        this.footer(),
      ].join("\n"),
    });
  }

  sendInvoice(to: string, name: string, orderNumber: string, invoice: { number: string | null; pdfUrl: string | null; accessKey: string | null }) {
    return this.send({
      to,
      subject: `Nota fiscal do pedido ${orderNumber}`,
      text: [
        `Oi, ${name}.`,
        "",
        `A nota fiscal do pedido ${orderNumber} foi emitida.`,
        invoice.number ? `Número: ${invoice.number}` : "",
        invoice.accessKey ? `Chave de acesso: ${invoice.accessKey}` : "",
        invoice.pdfUrl ? `DANFE: ${invoice.pdfUrl}` : "",
        this.footer(),
      ]
        .filter((l) => l !== "")
        .join("\n"),
    });
  }

  sendReturnUpdate(to: string, name: string, data: { protocol: string; orderNumber: string; statusLabel: string; note?: string | null }) {
    return this.send({
      to,
      subject: `Devolução ${data.protocol}: ${data.statusLabel}`,
      text: [
        `Oi, ${name}.`,
        "",
        `A solicitação ${data.protocol} (pedido ${data.orderNumber}) está agora: ${data.statusLabel}.`,
        data.note ? `\n${data.note}` : "",
        "",
        `Detalhes: ${this.frontendUrl}/conta/pedidos/${data.orderNumber}`,
        this.footer(),
      ].join("\n"),
    });
  }

  sendContactReceipt(to: string, name: string, protocol: string, respondBy: Date) {
    return this.send({
      to,
      subject: `Recebemos sua mensagem (protocolo ${protocol})`,
      text: [
        `Oi, ${name}.`,
        "",
        `Sua mensagem foi registrada com o protocolo ${protocol}.`,
        `Responderemos até ${respondBy.toLocaleDateString("pt-BR", { timeZone: "UTC" })} (5 dias úteis).`,
        this.footer(),
      ].join("\n"),
    });
  }

  sendAccountDeleted(to: string, name: string) {
    return this.send({
      to,
      subject: "Sua conta foi excluída",
      text: [
        `Oi, ${name}.`,
        "",
        "Atendendo ao seu pedido, a sua conta foi excluída e os seus dados pessoais foram anonimizados.",
        "Mantemos apenas o que a lei obriga a guardar (dados fiscais dos pedidos, por 5 anos), sem vínculo com a conta.",
        "Este é o último e-mail que enviamos para este endereço.",
        this.footer(),
      ].join("\n"),
    });
  }
}
