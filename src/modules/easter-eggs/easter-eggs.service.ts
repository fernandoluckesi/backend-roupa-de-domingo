import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface Identity {
  userId?: string;
  sessionId?: string;
}

/** Quantos easter eggs e preciso achar para liberar o produto secreto. */
export const SECRET_UNLOCK_THRESHOLD = 4;

@Injectable()
export class EasterEggsService {
  private readonly logger = new Logger(EasterEggsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private identityWhere({
    userId,
    sessionId,
  }: Identity): Prisma.EasterEggDiscoveryWhereInput {
    if (userId) return { userId };
    if (sessionId) return { sessionId };
    return { id: "__none__" };
  }

  async countDiscoveries(identity: Identity): Promise<number> {
    if (!identity.userId && !identity.sessionId) return 0;
    return this.prisma.easterEggDiscovery.count({
      where: this.identityWhere(identity),
    });
  }

  /**
   * Lista o catalogo. Easter eggs nao descobertos vem sem a mensagem,
   * para nao estragar a surpresa de quem olha a aba Network.
   */
  async list(identity: Identity) {
    const [eggs, discoveries] = await Promise.all([
      this.prisma.easterEgg.findMany({
        where: { isActive: true },
        orderBy: { points: "asc" },
        include: {
          rewardCoupon: { select: { code: true, description: true } },
        },
      }),
      identity.userId || identity.sessionId
        ? this.prisma.easterEggDiscovery.findMany({
            where: this.identityWhere(identity),
            select: { easterEggId: true, discoveredAt: true },
          })
        : Promise.resolve([]),
    ]);

    const found = new Map<string, Date>(
      discoveries.map((d) => [d.easterEggId, d.discoveredAt] as [string, Date]),
    );

    const items = eggs.map((egg) => {
      const discoveredAt = found.get(egg.id);
      const discovered = Boolean(discoveredAt);
      return {
        code: egg.code,
        title: discovered ? egg.title : "???",
        hint: egg.hint,
        points: egg.points,
        discovered,
        discoveredAt: discoveredAt ?? null,
        message: discovered ? egg.message : null,
        rewardCoupon: discovered ? egg.rewardCoupon : null,
      };
    });

    const totalPoints = eggs.reduce((acc, e) => acc + e.points, 0);
    const earnedPoints = eggs
      .filter((e) => found.has(e.id))
      .reduce((acc, e) => acc + e.points, 0);

    return {
      items,
      progress: {
        found: found.size,
        total: eggs.length,
        percent: eggs.length ? Math.round((found.size / eggs.length) * 100) : 0,
        earnedPoints,
        totalPoints,
        rank: this.rankFor(found.size, eggs.length),
        secretProductUnlocked: found.size >= SECRET_UNLOCK_THRESHOLD,
        secretProductIn: Math.max(0, SECRET_UNLOCK_THRESHOLD - found.size),
      },
    };
  }

  async progress(identity: Identity) {
    const { progress } = await this.list(identity);
    return progress;
  }

  /** Idempotente: descobrir duas vezes nao duplica nem repremia. */
  async discover(code: string, identity: Identity) {
    if (!identity.userId && !identity.sessionId) {
      throw new NotFoundException(
        "Sem identidade de sessao nao da para guardar trofeu. Envie o header x-session-id.",
      );
    }

    const egg = await this.prisma.easterEgg.findFirst({
      where: { code, isActive: true },
      include: { rewardCoupon: true },
    });

    if (!egg) {
      throw new NotFoundException("Esse easter egg nao existe. Boa tentativa.");
    }

    const where = {
      easterEggId: egg.id,
      ...(identity.userId
        ? { userId: identity.userId }
        : { sessionId: identity.sessionId }),
    };

    const existing = await this.prisma.easterEggDiscovery.findFirst({ where });

    if (!existing) {
      await this.prisma.easterEggDiscovery.create({ data: where });
      this.logger.log(`Easter egg descoberto: ${egg.code}`);
    }

    const progress = await this.progress(identity);

    return {
      code: egg.code,
      title: egg.title,
      message: egg.message,
      points: egg.points,
      alreadyFound: Boolean(existing),
      reward: egg.rewardCoupon
        ? {
            code: egg.rewardCoupon.code,
            description: egg.rewardCoupon.description,
            type: egg.rewardCoupon.type,
            value: egg.rewardCoupon.value,
          }
        : null,
      progress,
    };
  }

  /** Migra os trofeus da sessao anonima para o usuario no login. */
  async mergeSessionDiscoveries(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const sessionDiscoveries = await this.prisma.easterEggDiscovery.findMany({
      where: { sessionId },
    });

    for (const d of sessionDiscoveries) {
      const alreadyOwned = await this.prisma.easterEggDiscovery.findFirst({
        where: { easterEggId: d.easterEggId, userId },
      });
      if (alreadyOwned) {
        await this.prisma.easterEggDiscovery.delete({ where: { id: d.id } });
      } else {
        await this.prisma.easterEggDiscovery.update({
          where: { id: d.id },
          data: { userId, sessionId: null },
        });
      }
    }
  }

  private rankFor(found: number, total: number): string {
    if (found === 0) return "Cliente Normal (sem graça, mas respeitável)";
    if (found === total) return "Lenda do Domingo";
    const ratio = found / total;
    if (ratio < 0.3) return "Curioso Amador";
    if (ratio < 0.6) return "Fuçador Dedicado";
    if (ratio < 0.9) return "Garimpeiro de Ironia";
    return "Quase Lenda (falta pouco, não desista agora)";
  }
}
