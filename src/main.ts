import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { EasterEggHeaderInterceptor } from "./common/interceptors/easter-egg-header.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  const apiPrefix = config.get<string>("apiPrefix", "api");
  const port = config.get<number>("port", 3333);
  const corsOrigin = config.get<string>("corsOrigin", "http://localhost:5173");

  app.setGlobalPrefix(apiPrefix, { exclude: ["health"] });

  app.enableCors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-session-id",
      "x-print-signature",
    ],
    exposedHeaders: ["X-Powered-By-Domingo", "X-Easter-Eggs-Total"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EasterEggHeaderInterceptor());

  // Webhooks precisam do corpo cru para eventual validacao de assinatura
  app.use("/api/payments/webhook", (req: any, _res: any, next: any) => {
    req.rawBodyNeeded = true;
    next();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Roupa de Domingo API")
    .setDescription(
      "API da loja de camisetas, canecas e capas com humor acido e dropshipping de estamparia. " +
        "Sim, existem easter eggs aqui tambem. Nao, nao vamos dizer onde.",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .addGlobalParameters({
      name: "x-session-id",
      in: "header",
      required: false,
      description: "Identificador de sessao anonima (carrinho de convidado)",
      schema: { type: "string" },
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    customSiteTitle: "Roupa de Domingo API",
  });

  app.enableShutdownHooks();

  await app.listen(port, "0.0.0.0");

  logger.log(`API em http://localhost:${port}/${apiPrefix}`);
  logger.log(`Docs em http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`Driver de pagamento: ${config.get("payment.driver")}`);
  logger.log(`Provider de estamparia: ${config.get("print.provider")}`);
}

void bootstrap();
