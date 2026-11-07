import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { requestContextMiddleware } from "./common/request-context";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { EasterEggHeaderInterceptor } from "./common/interceptors/easter-egg-header.interceptor";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  const apiPrefix = config.get<string>("apiPrefix", "api");
  const port = config.get<number>("port", 3333);
  const corsOrigin = config.get<string>("corsOrigin", "http://localhost:5173");

  app.setGlobalPrefix(apiPrefix, { exclude: ["health"] });

  // Producao: cliente -> borda do Railway -> nginx do frontend -> API = 2 proxies confiaveis.
  // Assim req.ip e o IP real do cliente (rate limit por pessoa, nao por proxy).
  const hops = process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === "production" ? "2" : "loopback");
  app.set("trust proxy", /^\d+$/.test(hops) ? Number(hops) : hops);
  app.disable("x-powered-by");

  // Primeiro middleware: abre o contexto da requisicao (id + quem/IP) usado pela auditoria
  app.use(requestContextMiddleware);

  // Cabecalhos de seguranca. A API so devolve JSON, entao a CSP e a mais restrita possivel;
  // a pagina do Swagger (dev) precisa de inline, por isso fica fora da CSP estrita.
  const strictHelmet = helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  const docsHelmet = helmet({ contentSecurityPolicy: false });
  app.use((req: any, res: any, next: any) =>
    String(req.path).startsWith(`/${apiPrefix}/docs`) ? docsHelmet(req, res, next) : strictHelmet(req, res, next),
  );

  app.use(cookieParser());

  // CSRF: a sessao viaja em cookie, entao toda escrita autenticada por cookie
  // precisa do cabecalho X-Requested-With (um site de terceiro nao consegue envia-lo
  // sem passar pelo CORS, que so libera a nossa origem). SameSite=Lax cobre o resto.
  const sessionCookie = config.get<string>("security.sessionCookie", "rd_session");
  app.use((req: any, res: any, next: any) => {
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const cookieAuth = Boolean(req.cookies?.[sessionCookie]) && !req.headers.authorization;
    if (unsafe && cookieAuth && req.headers["x-requested-with"] !== "rd-web") {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "Requisicao bloqueada (protecao CSRF).",
        path: req.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  });

  app.enableCors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-session-id",
      "x-print-signature",
      "x-requested-with",
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

  // Swagger so fora de producao (SWAGGER_ENABLED=true reabre, por exemplo em staging)
  const swaggerEnabled = config.get<boolean>("security.swaggerEnabled", true);
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

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      customSiteTitle: "Roupa de Domingo API",
    });
  }

  app.enableShutdownHooks();

  // "::" escuta em IPv6 e IPv4 (dual-stack). A rede privada do Railway usa IPv6:
  // com "0.0.0.0" o frontend nao alcancaria o backend por <servico>.railway.internal.
  await app.listen(port, "::");

  logger.log(`API em http://localhost:${port}/${apiPrefix}`);
  logger.log(swaggerEnabled ? `Docs em http://localhost:${port}/${apiPrefix}/docs` : "Swagger desativado (producao)");
  logger.log(`Driver de pagamento: ${config.get("payment.driver")}`);
  logger.log(`Provider de estamparia: ${config.get("print.provider")}`);
}

void bootstrap();
