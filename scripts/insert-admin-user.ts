/**
 * Insere ou atualiza o usuário admin@bim.local em dim_usuarios.
 * Uso: npx tsx scripts/insert-admin-user.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const senha = bcrypt.hashSync("admin123", 10);
  const user = await prisma.dimUsuario.upsert({
    where: { email: "admin@bim.local" },
    create: {
      email: "admin@bim.local",
      nomeCompleto: "Administrador BIM",
      senhaHash: senha,
      perfil: "admin_bim",
      ativo: true,
    },
    update: { nomeCompleto: "Administrador BIM", senhaHash: senha, perfil: "admin_bim", ativo: true },
  });
  console.log("✅ Usuário admin@bim.local criado/atualizado (id:", user.id, ")");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});
