/* eslint-disable no-console */
/**
 * Seed da equipe do backoffice (tabela admin_users, separada dos clientes).
 *
 * Variaveis (a senha nunca fica no codigo nem no repositorio):
 *   ADMIN_EMAIL             e-mail do admin (sem ela o seed nao faz nada)
 *   ADMIN_NAME              nome (padrao "Admin")
 *   ADMIN_INITIAL_PASSWORD  senha, usada so quando o admin ainda nao existe
 *
 * Idempotente: roda a cada deploy (Dockerfile.railway). Admin existente nao tem a
 * senha alterada, a menos que rode com --reset-password (ai revoga as sessoes dele).
 * Depois do primeiro deploy, apague ADMIN_INITIAL_PASSWORD.
 *
 * Uso local: ADMIN_EMAIL=... ADMIN_INITIAL_PASSWORD=... npm run seed:admin [-- --reset-password]
 */
import { AuditActorType, AuditCategory, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_COST = 12;
const RESET = process.argv.includes("--reset-password");

/** 8 a 72 caracteres, com letras e numeros. */
function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 72) return "a senha precisa ter de 8 a 72 caracteres";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "a senha precisa ter letras e números";
  return null;
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  if (!email) {
    console.log("👤 ADMIN_EMAIL vazio: nenhum admin do backoffice criado.");
    return;
  }
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing) {
    if (!(RESET && password)) {
      console.log(`👤 Admin ${email} já existe (senha mantida).`);
      return;
    }
    const problem = passwordProblem(password);
    if (problem) throw new Error(`ADMIN_INITIAL_PASSWORD inválida: ${problem}`);
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    });
    await audit(existing.id, "admin.seed.password_reset");
    console.log(`👤 Admin ${email}: senha redefinida.`);
    return;
  }

  const problem = passwordProblem(password);
  if (problem) throw new Error(`ADMIN_INITIAL_PASSWORD inválida: ${problem}`);
  const admin = await prisma.adminUser.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
  });
  await audit(admin.id, "admin.seed.created");
  console.log(`👤 Admin do backoffice ${email} criado.`);
}

function audit(adminId: string, action: string) {
  return prisma.auditLog.create({
    data: { category: AuditCategory.SYSTEM, action, actorType: AuditActorType.SYSTEM, targetType: "admin_user", targetId: adminId },
  });
}

main()
  .catch((e) => {
    console.error("❌ seed:admin falhou:", (e as Error).message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
