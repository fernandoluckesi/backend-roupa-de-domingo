import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { AuditCategory, AuditOutcome } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { ConsentService } from "../privacy/consent.service";
import { AddressDto, DeleteAccountDto, UpdateProfileDto } from "./dto/users.dto";
import { onlyDigits } from "../../common/utils/order-number.util";

/** Com quem os dados podem ser compartilhados (LGPD art. 18, VII). */
export const DATA_SHARING = [
  {
    recipient: "Mercado Pago (Mercado Pago Instituição de Pagamento Ltda.)",
    country: "Brasil",
    purpose: "Processar o pagamento do pedido",
    data: ["nome", "e-mail", "CPF", "valor e itens do pedido"],
  },
  {
    recipient: "Empresa Brasileira de Correios e Telégrafos (Correios)",
    country: "Brasil",
    purpose: "Entregar os produtos",
    data: [
      "nome do destinatário",
      "endereço de entrega",
      "conteúdo e valor declarado do pacote",
    ],
  },
  {
    recipient: "Railway Corporation",
    country: "Estados Unidos (transferência internacional, LGPD art. 33)",
    purpose: "Hospedagem da aplicação e do banco de dados",
    data: ["dados da conta e dos pedidos, cifrados em trânsito; CPF cifrado em repouso"],
  },
  {
    recipient: "Provedor de e-mail transacional",
    country: "conforme o provedor contratado",
    purpose: "Enviar confirmações de pedido, de cadastro e de redefinição de senha",
    data: ["nome", "e-mail", "número e resumo do pedido"],
  },
];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly consents: ConsentService,
    private readonly audit: AuditService,
  ) {}

  private track(category: AuditCategory, action: string, userId: string, data?: Record<string, unknown>, failure = false) {
    this.audit.record({
      category,
      action,
      outcome: failure ? AuditOutcome.FAILURE : AuditOutcome.SUCCESS,
      target: { type: "user", id: userId },
      data,
    });
  }

  // ---------------------------------------------------------------- direitos do titular (LGPD art. 18)

  /** Confirmacao, acesso e portabilidade: todos os dados da conta em JSON legivel. */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        role: true,
        humorLevel: true,
        createdAt: true,
        updatedAt: true,
        emailVerifiedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        privacyVersion: true,
        marketingOptIn: true,
        marketingConsentAt: true,
        addresses: true,
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            items: true,
            payment: {
              select: { status: true, method: true, installments: true, amountCents: true, paidAt: true, provider: true },
            },
            fulfillment: { select: { status: true, trackingCode: true, trackingUrl: true, serviceCode: true, shippedAt: true, deliveredAt: true } },
            invoice: { select: { number: true, series: true, accessKey: true, issuedAt: true, status: true } },
            returns: true,
          },
        },
        cart: { include: { items: true } },
        discoveries: { include: { easterEgg: { select: { code: true, title: true } } } },
      },
    });

    const contacts = await this.prisma.contactMessage.findMany({
      where: { OR: [{ userId }, { email: user.email }] },
      select: {
        protocol: true,
        subject: true,
        orderNumber: true,
        message: true,
        status: true,
        createdAt: true,
        answeredAt: true,
      },
    });

    this.track(AuditCategory.PRIVACY, "privacy.data.exported", userId, {
      orders: user.orders.length,
      addresses: user.addresses.length,
    });
    return {
      generatedAt: new Date().toISOString(),
      controller: "Roupa de Domingo",
      legalBasis: "LGPD art. 18, I, II e V (confirmação, acesso e portabilidade)",
      account: user,
      consents: await this.consents.listForUser(userId),
      contactMessages: contacts,
      sharedWith: DATA_SHARING,
    };
  }

  sharing() {
    return DATA_SHARING;
  }

  async setMarketingConsent(userId: string, granted: boolean, meta: { ip?: string; userAgent?: string } = {}) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { marketingOptIn: granted, marketingConsentAt: granted ? new Date() : null },
      select: { marketingOptIn: true, marketingConsentAt: true, privacyVersion: true },
    });
    await this.consents.record({
      userId,
      kind: "marketing",
      version: user.privacyVersion ?? "desconhecida",
      granted,
      ...meta,
    });
    this.track(AuditCategory.PRIVACY, "privacy.consent.changed", userId, { kind: "marketing", granted });
    return { marketingOptIn: user.marketingOptIn, marketingConsentAt: user.marketingConsentAt };
  }

  /**
   * Eliminacao (art. 18, VI): anonimiza a conta. Pedidos ficam pelo prazo fiscal
   * (5 anos, art. 16, I), desvinculados da pessoa. Pedido em andamento bloqueia.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      this.track(AuditCategory.ACCOUNT, "account.delete_failed", userId, { reason: "wrong_password" }, true);
      throw new BadRequestException("Senha incorreta.");
    }

    const open = await this.prisma.order.count({
      where: { userId, status: { in: ["PAID", "IN_PRODUCTION", "SHIPPED"] } },
    });
    if (open > 0) {
      this.track(AuditCategory.ACCOUNT, "account.delete_failed", userId, { reason: "open_orders", openOrders: open }, true);
      throw new BadRequestException(
        "Você tem pedido em andamento. Assim que ele for entregue (ou cancelado), a conta pode ser excluída.",
      );
    }

    const anonymousEmail = `excluido-${user.id}@anonimizado.invalid`;
    const unusablePassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId } }),
      this.prisma.cart.deleteMany({ where: { userId } }),
      this.prisma.authToken.deleteMany({ where: { userId } }),
      this.prisma.easterEggDiscovery.deleteMany({ where: { userId } }),
      // Pedidos ficam para a contabilidade, sem o vinculo com a pessoa
      this.prisma.order.updateMany({
        where: { userId },
        data: { userId: null, customerPhone: null, notes: null },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: anonymousEmail,
          name: "Conta excluída",
          phone: null,
          document: null,
          passwordHash: unusablePassword,
          marketingOptIn: false,
          marketingConsentAt: null,
          tokenVersion: { increment: 1 },
          deletedAt: new Date(),
        },
      }),
    ]);

    await this.consents.record({
      userId,
      kind: "marketing",
      version: user.privacyVersion ?? "-",
      granted: false,
      details: { reason: "account_deleted", note: dto.reason ?? null },
    });
    void this.mail.sendAccountDeleted(user.email, user.name);
    // Sem motivo em texto livre na trilha (pode conter dado pessoal); ele fica no ConsentRecord
    this.track(AuditCategory.ACCOUNT, "account.deleted", userId, { anonymized: true, reasonGiven: Boolean(dto.reason) });
    return { deleted: true };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        humorLevel: true,
        role: true,
      },
    });
    // So os nomes dos campos alterados: os valores sao dado pessoal
    this.track(AuditCategory.ACCOUNT, "account.profile.updated", userId, {
      fields: Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined),
    });
    return updated;
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async createAddress(userId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    const isDefault = dto.isDefault ?? count === 0;

    if (isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        ...dto,
        zipCode: onlyDigits(dto.zipCode),
        state: dto.state.toUpperCase(),
        isDefault,
        userId,
      },
    });
    this.track(AuditCategory.ACCOUNT, "account.address.created", userId, { addressId: address.id, isDefault });
    return address;
  }

  async updateAddress(userId: string, addressId: string, dto: AddressDto) {
    await this.assertOwnership(userId, addressId);

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...dto,
        zipCode: onlyDigits(dto.zipCode),
        state: dto.state.toUpperCase(),
      },
    });
    this.track(AuditCategory.ACCOUNT, "account.address.updated", userId, { addressId });
    return address;
  }

  async removeAddress(userId: string, addressId: string) {
    await this.assertOwnership(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    this.track(AuditCategory.ACCOUNT, "account.address.deleted", userId, { addressId });
    return { removed: true };
  }

  private async assertOwnership(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!address) {
      throw new NotFoundException("Endereco nao encontrado.");
    }
  }
}
