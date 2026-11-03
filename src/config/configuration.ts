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
  };
  print: {
    provider: "mock" | "http";
    apiUrl: string;
    apiKey: string;
    webhookSecret: string;
    mockSpeed: number;
  };
  business: {
    freeShippingThresholdCents: number;
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
  },
  print: {
    provider: (process.env.PRINT_PROVIDER as "mock" | "http") ?? "mock",
    apiUrl: process.env.PRINT_API_URL ?? "",
    apiKey: process.env.PRINT_API_KEY ?? "",
    webhookSecret: process.env.PRINT_WEBHOOK_SECRET ?? "segredo-estamparia",
    mockSpeed: parseFloat(process.env.PRINT_MOCK_SPEED ?? "1"),
  },
  business: {
    freeShippingThresholdCents: parseInt(
      process.env.FREE_SHIPPING_THRESHOLD_CENTS ?? "24900",
      10,
    ),
  },
});
