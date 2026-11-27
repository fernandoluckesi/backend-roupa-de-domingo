/**
 * Usuario de teste para desenvolvimento local. Nao apaga nada: cria ou atualiza so esta conta.
 *   npm run seed:test-user
 * Bloqueado com NODE_ENV=production (senha conhecida nao pode existir em producao).
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export const TEST_USER = {
  email: "email.teste@email.com",
  password: "Fernando958969++",
  name: "Usuário Teste",
};

export async function upsertTestUser(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(TEST_USER.password, 10);
  return prisma.user.upsert({
    where: { email: TEST_USER.email },
    update: { passwordHash, emailVerifiedAt: new Date(), deletedAt: null },
    create: { email: TEST_USER.email, name: TEST_USER.name, passwordHash, emailVerifiedAt: new Date() },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed-test-user nao roda em producao.");
  const prisma = new PrismaClient();
  try {
    const user = await upsertTestUser(prisma);
    console.log(`👤 Usuario de teste pronto: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
