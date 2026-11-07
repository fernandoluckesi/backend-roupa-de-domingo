export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  frontendUrl: string;
  jwt: { secret: string; expiresIn: string };
  payment: {
    driver: "mock" | "mercadopago";
    accessToken: string;
    publicKey: string;
    useSandbox: boolean;
    notificationUrl: string;
    /** Assinatura secreta do webhook (painel do MP). Vazia = nao valida x-signature */
    webhookSecret: string;
  };
  print: {
    provider: "mock" | "http" | "printful";
    apiUrl: string;
    apiKey: string;
    webhookSecret: string;
    mockSpeed: number;
    printful: {
      storeId: string;
      /** false = pedidos ficam em rascunho na Printful (sem cobranca) */
      confirmOrders: boolean;
    };
  };
  business: {
    freeShippingThresholdCents: number;
  };
  security: {
    /** Chave AES-256 (base64, 32 bytes) para cifrar CPF e segredo 2FA em repouso */
    dataEncryptionKey: string;
    /** Nome do cookie httpOnly da sessao */
    sessionCookie: string;
    cookieSecure: boolean;
    swaggerEnabled: boolean;
    /** Rotas de admin exigem 2FA ativo */
    adminTwoFactorRequired: boolean;
    /** Tentativas de login antes do bloqueio temporario */
    maxFailedLogins: number;
    lockMinutes: number;
    /** Dias que a trilha de auditoria fica guardada (padrao 5 anos: prazo do CDC e fiscal) */
    auditRetentionDays: number;
  };
  mail: {
    driver: "log" | "smtp";
    from: string;
    sacInbox: string;
    smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
  };
  invoice: {
    /** mock: gera numero interno; trocar por um emissor de NF-e real (ver docs) */
    provider: "mock";
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3333", 10),
  apiPrefix: process.env.API_PREFIX ?? "api",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  jwt: {
    secret: process.env.JWT_SECRET ?? "domingo-dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  },
  payment: {
    driver: (process.env.PAYMENT_DRIVER as "mock" | "mercadopago") ?? "mock",
    accessToken: process.env.MP_ACCESS_TOKEN ?? "",
    publicKey: process.env.MP_PUBLIC_KEY ?? "",
    useSandbox: process.env.MP_USE_SANDBOX !== "false",
    notificationUrl: process.env.MP_NOTIFICATION_URL ?? "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
  },
  print: {
    provider:
      (process.env.PRINT_PROVIDER as "mock" | "http" | "printful") ?? "mock",
    apiUrl: process.env.PRINT_API_URL ?? "",
    apiKey: process.env.PRINT_API_KEY ?? "",
    webhookSecret: process.env.PRINT_WEBHOOK_SECRET ?? "segredo-estamparia",
    mockSpeed: parseFloat(process.env.PRINT_MOCK_SPEED ?? "1"),
    printful: {
      storeId: process.env.PRINTFUL_STORE_ID ?? "",
      confirmOrders: process.env.PRINTFUL_CONFIRM_ORDERS === "true",
    },
  },
  business: {
    freeShippingThresholdCents: parseInt(
      process.env.FREE_SHIPPING_THRESHOLD_CENTS ?? "24900",
      10,
    ),
  },
  security: {
    dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? "",
    sessionCookie: process.env.SESSION_COOKIE_NAME ?? "rd_session",
    cookieSecure:
      process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === "true"
        : process.env.NODE_ENV === "production",
    swaggerEnabled:
      process.env.SWAGGER_ENABLED !== undefined
        ? process.env.SWAGGER_ENABLED === "true"
        : process.env.NODE_ENV !== "production",
    adminTwoFactorRequired: process.env.ADMIN_2FA_REQUIRED !== "false",
    maxFailedLogins: parseInt(process.env.MAX_FAILED_LOGINS ?? "5", 10),
    lockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES ?? "15", 10),
    auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS ?? "1825", 10),
  },
  mail: {
    driver: (process.env.MAIL_DRIVER as "log" | "smtp") ?? "log",
    from: process.env.MAIL_FROM ?? "Roupa de Domingo <nao-responda@roupadedomingo.com.br>",
    sacInbox: process.env.MAIL_SAC_INBOX ?? "sac@roupadedomingo.com.br",
    smtp: {
      host: process.env.SMTP_HOST ?? "",
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    },
  },
  invoice: {
    provider: "mock",
  },
});
