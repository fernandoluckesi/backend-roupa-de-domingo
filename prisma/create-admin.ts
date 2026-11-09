/* eslint-disable no-console */
/**
 * Cria ou promove um usuario a ADMIN (acesso ao backoffice).
 *
 * Variaveis:
 *   ADMIN_EMAIL             e-mail do admin (sem ela o script nao faz nada)
 *   ADMIN_NAME              nome (so na criacao; padrao "Admin")
 *   ADMIN_INITIAL_PASSWORD  senha, usada so quando a conta ainda nao existe
 *
 * Conta existente: vira ADMIN e fica com o e-mail confirmado; a senha NAO muda,
 * a menos que rode com --reset-password (ai revoga as sessoes abertas).
 * Idempotente: roda a cada deploy. Depois do primeiro deploy, apague ADMIN_INITIAL_PASSWORD.
 *
 * Uso local: ADMIN_EMAIL=... ADMIN_INITIAL_PASSWORD=... npm run admin:create [-- --reset-password]
 */
import { AuditActorType, AuditCategory, PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_COST = 12;
const RESET = process.argv.includes("--reset-password");

/** Mesma regra do cadastro: 8 a 72 caracteres, com letra e numero. */
function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 72) return "a senha precisa ter de 8 a 72 caracteres";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "a senha precisa ter letras e números";
  return null;
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  if (!email) {
    console.log("👤 ADMIN_EMAIL vazio: nenhum admin criado.");
    return;
  }
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.deletedAt) {
    throw new Error("essa conta foi excluída a pedido do titular e não pode virar admin");
  }

  if (existing) {
    const resetPassword = RESET && password;
    if (resetPassword) {
      const problem = passwordProblem(password);
      if (problem) throw new Error(problem);
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: Role.ADMIN,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        ...(resetPassword
          ? {
              passwordHash: await bcrypt.hash(password, BCRYPT_COST),
              failedLoginCount: 0,
              lockedUntil: null,
              tokenVersion: { increment: 1 },
            }
          : {}),
      },
    });
    await audit(existing.id, existing.role === Role.ADMIN ? "admin.bootstrap.confirmed" : "admin.bootstrap.promoted", {
      passwordReset: Boolean(resetPassword),
    });
    console.log(
      `👤 ${email}: ${existing.role === Role.ADMIN ? "já era admin" : "promovido a admin"}${resetPassword ? ", senha redefinida" : ""}.`,
    );
    return;
  }

  const problem = passwordProblem(password);
  if (problem) throw new Error(`ADMIN_INITIAL_PASSWORD inválida: ${problem}`);
  const user = await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME?.trim() || "Admin",
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });
  await audit(user.id, "admin.bootstrap.created", {});
  console.log(`👤 Admin ${email} criado.`);
}

function audit(userId: string, action: string, payload: Record<string, unknown>) {
  return prisma.auditLog.create({
    data: {
      category: AuditCategory.SYSTEM,
      action,
      actorType: AuditActorType.SYSTEM,
      targetType: "user",
      targetId: userId,
      payload: Object.keys(payload).length ? (payload as object) : undefined,
    },
  });
}

main()
  .catch((e) => {
    console.error("❌ admin:create falhou:", (e as Error).message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
