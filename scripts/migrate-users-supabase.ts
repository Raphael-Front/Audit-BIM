/**
 * Migra dim_usuarios para Supabase Auth.
 * Cria auth.users para cada dim_usuario sem auth_user_id e vincula.
 * Se o usuário já existir em auth.users, apenas vincula (atualiza auth_user_id).
 *
 * Execute:
 *   npx tsx scripts/migrate-users-supabase.ts
 *     — migra todos os dim_usuarios com auth_user_id nulo
 *
 *   npx tsx scripts/migrate-users-supabase.ts email1@exemplo.com email2@exemplo.com
 *     — migra apenas os emails informados (mesmo que já tenham auth_user_id, tenta vincular)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Busca auth user por email via listUsers (Supabase não tem getUserByEmail direto) */
async function findAuthUserByEmail(email: string): Promise<string | null> {
  const norm = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Erro ao listar auth.users:", error.message);
      return null;
    }
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === norm);
    if (found) return found.id;
    if (data.users.length < perPage) break;
    page++;
  }
  return null;
}

async function migrateUser(u: { id: string; email: string; nomeCompleto: string }) {
  const tempPassword = `Temp${Math.random().toString(36).slice(2, 12)}!`;
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: u.email,
    email_confirm: true,
    password: tempPassword,
    user_metadata: { nome: u.nomeCompleto },
  });

  if (!error) {
    await supabase.from("dim_usuarios").update({ auth_user_id: created.user.id }).eq("id", u.id);
    console.log(`✓ Criado e vinculado: ${u.email} (auth_user_id=${created.user.id})`);
    console.log(`  Senha temporária: ${tempPassword} — usuário deve trocar no primeiro login.`);
    return;
  }

  // Usuário já existe em auth.users — buscar e vincular
  const isAlreadyRegistered =
    /already registered|already exists|duplicate/i.test(error.message) || error.message.includes("already");
  if (isAlreadyRegistered) {
    const authId = await findAuthUserByEmail(u.email);
    if (authId) {
      const { error: updateErr } = await supabase
        .from("dim_usuarios")
        .update({ auth_user_id: authId })
        .eq("id", u.id);
      if (updateErr) {
        console.error(`✗ Erro ao vincular ${u.email}:`, updateErr.message);
      } else {
        console.log(`✓ Vinculado (já existia em Auth): ${u.email} (auth_user_id=${authId})`);
      }
    } else {
      console.error(`✗ ${u.email}: usuário existe em auth mas não foi encontrado na busca.`);
    }
  } else {
    console.error(`✗ Erro ao criar auth.users para ${u.email}:`, error.message);
  }
}

async function main() {
  const filterEmails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);

  let query = supabase.from("dim_usuarios").select("id, email, nomeCompleto");
  if (filterEmails.length > 0) {
    query = query.in("email", filterEmails);
    console.log(`Filtrando por emails: ${filterEmails.join(", ")}\n`);
  } else {
    query = query.is("auth_user_id", null);
  }

  const { data: users, error } = await query;
  if (error) {
    console.error("Erro ao buscar dim_usuarios:", error.message);
    process.exit(1);
  }

  if (!users?.length) {
    console.log(
      filterEmails.length
        ? "Nenhum dim_usuario encontrado com os emails informados."
        : "Nenhum dim_usuario pendente de migração (auth_user_id nulo)."
    );
    return;
  }

  for (const u of users) {
    await migrateUser(u);
  }
}

main().catch(console.error);
