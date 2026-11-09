import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { decrypt, encrypt, isEncrypted } from "../common/utils/crypto.util";

/** Campos cifrados em repouso (AES-256-GCM). Ver common/utils/crypto.util.ts */
export const ENCRYPTED_FIELDS = new Set(["document", "customerDocument"]);

const WRITE_ACTIONS = new Set(["create", "createMany", "update", "updateMany", "upsert"]);

function encryptDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => encryptDeep(v, depth + 1));
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (ENCRYPTED_FIELDS.has(k)) {
      if (typeof v === "string" && v !== "") obj[k] = encrypt(v);
      else if (v && typeof v === "object" && typeof (v as { set?: unknown }).set === "string") {
        (v as { set: string }).set = encrypt((v as { set: string }).set);
      }
    } else if (v && typeof v === "object" && !(v instanceof Date)) {
      encryptDeep(v, depth + 1);
    }
  }
  return obj;
}

function decryptDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    value.forEach((v) => decryptDeep(v, depth + 1));
    return value;
  }
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (ENCRYPTED_FIELDS.has(k) && isEncrypted(v)) obj[k] = decrypt(v);
    else if (v && typeof v === "object" && !(v instanceof Date)) decryptDeep(v, depth + 1);
  }
  return obj;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    // Cifra CPF/segredos na escrita e decifra na leitura, em qualquer model ou include aninhado
    this.$use(async (params, next) => {
      if (WRITE_ACTIONS.has(params.action) && params.args) {
        encryptDeep(params.args);
      }
      const result = await next(params);
      return decryptDeep(result);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Conectado ao PostgreSQL");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
