/**
 * Migra dim_usuarios para Supabase Auth.
 * Cria auth.users para cada dim_usuario sem auth_user_id e vincula.
 * Execute: npx tsx scripts/migrate-users-supabase.ts
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

async function main() {
  const { data: users } = await supabase
    .from("dim_usuarios")
    .select("id, email, nomeCompleto")
    .is("auth_user_id", null);

  if (!users?.length) {
    console.log("Nenhum dim_usuario pendente de migração.");
    return;
  }

  for (const u of users) {
    const tempPassword = `Temp${Math.random().toString(36).slice(2, 12)}!`;
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: u.email,
      email_confirm: true,
      password: tempPassword,
      user_metadata: { nome: u.nomeCompleto },
    });
    if (error) {
      console.error(`Erro ao criar auth.users para ${u.email}:`, error.message);
      continue;
    }
    await supabase
      .from("dim_usuarios")
      .update({ auth_user_id: created.user.id })
      .eq("id", u.id);
    console.log(`Migrado: ${u.email} (auth_user_id=${created.user.id})`);
    console.log(`  Senha temporária: ${tempPassword} — usuário deve trocar no primeiro login.`);
  }
}

main().catch(console.error);
