import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { hashIdentifier } from "../../common/utils/crypto.util";

export interface ConsentInput {
  userId?: string | null;
  sessionId?: string | null;
  /** cookies | terms | privacy | marketing */
  kind: "cookies" | "terms" | "privacy" | "marketing";
  version: string;
  granted: boolean;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/** Registro auditavel de consentimentos (LGPD art. 8o par. 2o: o onus da prova e do controlador). */
@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: ConsentInput) {
    return this.prisma.consentRecord.create({
      data: {
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        kind: input.kind,
        version: input.version,
        granted: input.granted,
        details: (input.details ?? undefined) as object | undefined,
        ipHash: hashIdentifier(input.ip),
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
  }

  listForUser(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { kind: true, version: true, granted: true, details: true, createdAt: true },
    });
  }
}
