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

  /** Codigo de 6 digitos: confirmar cadastro, trocar e-mail, trocar ou redefinir a senha. */
  sendVerificationCode(
    to: string,
    name: string,
    code: string,
    purpose: "register" | "email-change" | "password-change" | "password-reset" | "login",
  ) {
    const copy = {
      login: {
        subject: `${code} é o seu código de acesso ao backoffice`,
        intro: "Use o código abaixo para entrar no backoffice da Roupa de Domingo:",
        ignore: `Se não foi você, alguém sabe a sua senha: troque agora em ${this.frontendUrl}/esqueci-a-senha.`,
      },
      register: {
        subject: `${code} é o seu código de confirmação`,
        intro: "Use o código abaixo para confirmar o seu cadastro na Roupa de Domingo:",
        ignore: "Se não foi você que criou a conta, ignore esta mensagem.",
      },
      "email-change": {
        subject: `${code} é o código para confirmar o seu novo e-mail`,
        intro: "Use o código abaixo para confirmar este endereço como o novo e-mail da sua conta na Roupa de Domingo:",
        ignore: "Se não foi você que pediu a troca, ignore esta mensagem: nada muda na conta.",
      },
      "password-change": {
        subject: `${code} é o código para trocar a sua senha`,
        intro: "Use o código abaixo para confirmar a troca da sua senha:",
        ignore: `Se não foi você, não passe este código para ninguém e troque a senha agora: ${this.frontendUrl}/esqueci-a-senha`,
      },
      "password-reset": {
        subject: `${code} é o código para redefinir a sua senha`,
        intro: "Recebemos um pedido para redefinir a sua senha. Use o código abaixo:",
        ignore: "Se não foi você, ignore este e-mail: a sua senha continua a mesma.",
      },
    }[purpose];
    return this.send({
      to,
      subject: copy.subject,
      text: [
        `Oi, ${name}.`,
        "",
        copy.intro,
        "",
        `    ${code}`,
        "",
        "O código vale por 15 minutos e só pode ser usado uma vez. A Roupa de Domingo nunca pede esse código por telefone ou WhatsApp.",
        "",
        copy.ignore,
        this.footer(),
      ].join("\n"),
    });
  }

  /** Aviso no endereco antigo: se a troca nao foi do dono, ele fica sabendo. */
  sendEmailChanged(to: string, name: string, newEmail: string) {
    return this.send({
      to,
      subject: "O e-mail da sua conta foi alterado",
      text: [
        `Oi, ${name}.`,
        "",
        `O e-mail da sua conta na Roupa de Domingo foi alterado para ${maskEmail(newEmail)}. Este endereço não recebe mais as mensagens da conta.`,
        `Se não foi você, fale com o SAC agora: ${this.frontendUrl}/contato`,
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

  sendOrderShipped(to: string, name: string, data: { orderNumber: string; trackingCode: string; trackingUrl: string; serviceCode: string | null; estimatedDays: number }) {
    return this.send({
      to,
      subject: `Pedido ${data.orderNumber} postado nos Correios`,
      text: [
        `Oi, ${name}.`,
        "",
        `O pedido ${data.orderNumber} foi postado nos Correios${data.serviceCode ? ` (${data.serviceCode})` : ""}. Agora é com o carteiro.`,
        "",
        `Código de rastreio: ${data.trackingCode}`,
        `Rastreie: ${data.trackingUrl}`,
        `Prazo estimado de transporte: até ${data.estimatedDays} dias.`,
        "",
        `Acompanhe o pedido: ${this.frontendUrl}/conta/pedidos/${data.orderNumber}`,
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
