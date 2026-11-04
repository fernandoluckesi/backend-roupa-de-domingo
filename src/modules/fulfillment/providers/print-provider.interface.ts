export interface PrintRecipient {
  name: string;
  phone?: string | null;
  document?: string | null;
  zipCode: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
}

export interface PrintItemInput {
  sku: string;
  providerVariantId?: string | null;
  productName: string;
  variantLabel: string;
  quantity: number;
  customText?: string | null;
  artworkUrl?: string | null;
}

export interface CreatePrintOrderInput {
  externalId: string;
  recipient: PrintRecipient;
  items: PrintItemInput[];
  shippingMethod: string;
}

export type PrintOrderStatus =
  | "QUEUED"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED"
  | "ERROR";

export interface PrintOrderResult {
  providerOrderId: string;
  status: PrintOrderStatus;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  /** Pedido criado como rascunho no parceiro: nao foi confirmado nem cobrado */
  draft?: boolean;
  raw: unknown;
}

/**
 * Porta para o parceiro de estamparia (dropshipping).
 * Trocar de fornecedor e implementar esta interface; o dominio nao muda.
 */
export interface PrintProvider {
  readonly name: string;
  createOrder(input: CreatePrintOrderInput): Promise<PrintOrderResult>;
  getOrder(providerOrderId: string): Promise<PrintOrderResult>;
  cancelOrder(providerOrderId: string): Promise<void>;
}

export const PRINT_PROVIDER = Symbol("PRINT_PROVIDER");
