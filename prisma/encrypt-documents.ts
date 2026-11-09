/* eslint-disable no-console */
/**
 * Cifra em repouso os CPFs gravados antes da criptografia existir
 * (User.document, Order.customerDocument). Idempotente: valores ja cifrados
 * (prefixo "enc:v1:") sao ignorados, entao roda a cada deploy sem efeito colateral.
 *
 * Uso: npm run data:encrypt  (sem DATA_ENCRYPTION_KEY usa a chave derivada do JWT_SECRET; --rotate regrava com a chave nova)
 */
import { PrismaClient } from "@prisma/client";
import { decrypt, encrypt, needsRotation } from "../src/common/utils/crypto.util";

const prisma = new PrismaClient();
const ENCRYPTED_PREFIX = "enc:v1:";
const ROTATE = process.argv.includes("--rotate");

/** --rotate: regrava com a chave atual o que foi cifrado com a chave derivada antiga */
async function rotate() {
  let count = 0;
  for (const user of await prisma.user.findMany({ select: { id: true, document: true } })) {
    const data: Record<string, string> = {};
    if (user.document && needsRotation(user.document)) data.document = encrypt(decrypt(user.document));
    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: user.id }, data });
      count++;
    }
  }
  for (const order of await prisma.order.findMany({ where: { customerDocument: { startsWith: ENCRYPTED_PREFIX } }, select: { id: true, customerDocument: true } })) {
    if (order.customerDocument && needsRotation(order.customerDocument)) {
      await prisma.order.update({ where: { id: order.id }, data: { customerDocument: encrypt(decrypt(order.customerDocument)) } });
      count++;
    }
  }
  console.log("🔁 Registros regravados com a chave nova:", count);
}

async function main() {
  if (ROTATE) await rotate();
  const users = await prisma.user.findMany({
    where: { document: { not: null }, NOT: { document: { startsWith: ENCRYPTED_PREFIX } } },
    select: { id: true, document: true },
  });
  for (const user of users) {
    if (user.document) {
      await prisma.user.update({ where: { id: user.id }, data: { document: encrypt(user.document) } });
    }
  }

  const orders = await prisma.order.findMany({
    where: { customerDocument: { not: null }, NOT: { customerDocument: { startsWith: ENCRYPTED_PREFIX } } },
    select: { id: true, customerDocument: true },
  });
  for (const order of orders) {
    if (order.customerDocument) {
      await prisma.order.update({ where: { id: order.id }, data: { customerDocument: encrypt(order.customerDocument) } });
    }
  }


  console.log("🔐 Dados cifrados em repouso:", {
    cpfsDeUsuarios: users.length,
    cpfsDePedidos: orders.length,
  });
}

main()
  .catch((e) => {
    console.error("❌ data:encrypt falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
