/**
 * Script para verificar e corrigir o perfil do usuário no banco
 * Execute: npx tsx scripts/check-user-role.ts <email-do-usuario>
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserRole(email: string) {
  console.log(`\n🔍 Verificando usuário: ${email}\n`);

  // 1. Buscar no Supabase Auth
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("❌ Erro ao listar usuários do Auth:", authError);
    return;
  }

  const authUser = authUsers.users.find((u) => u.email === email);
  if (!authUser) {
    console.error(`❌ Usuário ${email} não encontrado no Supabase Auth`);
    return;
  }

  console.log("✅ Usuário encontrado no Auth:");
  console.log(`   ID: ${authUser.id}`);
  console.log(`   Email: ${authUser.email}`);
  console.log(`   Metadata:`, authUser.user_metadata);

  // 2. Buscar em dim_usuarios
  const { data: dimUser, error: dimError } = await supabase
    .from("dim_usuarios")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (dimError) {
    console.error("❌ Erro ao buscar dim_usuario:", dimError);
    return;
  }

  if (!dimUser) {
    console.log("⚠️  Usuário não encontrado em dim_usuarios");
    console.log("💡 Execute a função ensure_dim_usuario() ou crie manualmente");
    return;
  }

  console.log("\n✅ Usuário encontrado em dim_usuarios:");
  console.log(`   ID: ${dimUser.id}`);
  console.log(`   Email: ${dimUser.email}`);
  console.log(`   Nome: ${dimUser.nomeCompleto}`);
  console.log(`   Perfil atual: ${dimUser.perfil}`);
  console.log(`   Auth User ID: ${dimUser.auth_user_id}`);

  // 3. Verificar se é admin
  if (dimUser.perfil === "admin_bim") {
    console.log("\n✅ Usuário JÁ É ADMIN! O problema pode ser:");
    console.log("   1. Cache do React Query - tente limpar o cache do navegador");
    console.log("   2. A query authMe não está retornando corretamente");
    console.log("   3. Verifique o console do navegador para logs detalhados");
  } else {
    console.log(`\n⚠️  Usuário NÃO é admin (perfil: ${dimUser.perfil})`);
    console.log("\n💡 Para tornar admin, execute no SQL Editor do Supabase:");
    console.log(`\nUPDATE dim_usuarios SET perfil = 'admin_bim' WHERE id = '${dimUser.id}';\n`);
  }
}

const email = process.argv[2];
if (!email) {
  console.error("❌ Uso: npx tsx scripts/check-user-role.ts <email-do-usuario>");
  process.exit(1);
}

checkUserRole(email).catch(console.error);

