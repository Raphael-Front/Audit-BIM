/**
 * Migração de usuários: lê planilha (ou CSV) e cria contas no Supabase Auth + user_profiles.
 * Gera senhas temporárias; opção de forçar reset no primeiro login.
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

const LOG_DIR = ".";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function generateTempPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[buf[i]! % chars.length];
  return out;
}

type UserRow = { email: string; nome?: string; role?: string };
const roleMap: Record<string, string> = {
  admin: "admin",
  auditor: "auditor",
  visualizador: "visualizador",
  reader: "visualizador",
};

async function main() {
  const filePath = process.argv[2];
  const forceReset = process.argv.includes("--reset-password");
  if (!filePath) {
    console.error("Uso: npm run migrate-users -- <planilha-usuarios.xlsx> [--reset-password]");
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error("Arquivo não encontrado:", filePath);
    process.exit(1);
  }

  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0] ?? "Usuários";
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, { defval: null });
  const users: UserRow[] = rows.map((r) => ({
    email: String(r["Email"] ?? r["email"] ?? "").trim().toLowerCase(),
    nome: r["Nome"] ?? r["name"] ? String(r["Nome"] ?? r["name"]).trim() : undefined,
    role: r["Role"] ?? r["role"] ? String(r["Role"] ?? r["role"]).trim().toLowerCase() : undefined,
  })).filter((u) => u.email);

  if (users.length === 0) {
    console.error("Nenhum usuário com email encontrado na planilha.");
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const results: { email: string; status: "created" | "updated" | "skipped" | "error"; message?: string; tempPassword?: string }[] = [];

  for (const u of users) {
    const role = roleMap[u.role ?? ""] ?? "auditor";
    const tempPassword = generateTempPassword();
    try {
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((x) => x.email?.toLowerCase() === u.email);
      if (found) {
        await supabase.from("user_profiles").upsert({
          id: found.id,
          nome: u.nome ?? found.email,
          role,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
        results.push({ email: u.email, status: "updated" });
        continue;
      }
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nome: u.nome },
      });
      if (error) {
        results.push({ email: u.email, status: "error", message: error.message });
        continue;
      }
      if (created?.user?.id) {
        await supabase.from("user_profiles").insert({
          id: created.user.id,
          nome: u.nome ?? u.email,
          role,
          active: true,
        });
        if (forceReset) {
          await supabase.auth.admin.generateLink({ type: "recovery", email: u.email });
        }
        results.push({ email: u.email, status: "created", tempPassword });
      } else {
        results.push({ email: u.email, status: "error", message: "User not returned" });
      }
    } catch (e) {
      results.push({ email: u.email, status: "error", message: String(e) });
    }
  }

  const created = results.filter((r) => r.status === "created");
  const withPasswords = created.filter((r) => r.tempPassword);
  let report = "# Migração de Usuários\n\n";
  report += `Total processados: ${results.length}\n`;
  report += `Criados: ${created.length}\n`;
  report += `Atualizados: ${results.filter((r) => r.status === "updated").length}\n`;
  report += `Erros: ${results.filter((r) => r.status === "error").length}\n\n`;
  if (withPasswords.length) {
    report += "## Senhas temporárias (entregar de forma segura)\n\n";
    withPasswords.forEach((r) => (report += `- ${r.email}: ${r.tempPassword}\n`));
  }
  report += "\n## Detalhes\n";
  results.forEach((r) => (report += `- ${r.email}: ${r.status}${r.message ? ` - ${r.message}` : ""}\n`));
  console.log(report);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  writeFileSync(join(LOG_DIR, `migrate-users-${ts}.md`), report, "utf-8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
