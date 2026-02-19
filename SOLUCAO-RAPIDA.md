# 🔧 SOLUÇÃO RÁPIDA - Engrenagem de Configurações

## Problema
A engrenagem de configurações não aparece mesmo sendo admin.

## Solução Rápida (2 minutos)

### 1. Verificar seu perfil no banco

Execute no **SQL Editor do Supabase**:

```sql
-- Ver seu perfil atual
SELECT id, email, "nomeCompleto", perfil, "auth_user_id" 
FROM dim_usuarios 
WHERE email = 'SEU-EMAIL-AQUI@exemplo.com';
```

### 2. Se não for admin, tornar admin:

```sql
-- Tornar admin (SUBSTITUA pelo seu email)
UPDATE dim_usuarios 
SET perfil = 'admin_bim' 
WHERE email = 'SEU-EMAIL-AQUI@exemplo.com';
```

### 3. Se o usuário não existir em dim_usuarios:

```sql
-- Criar registro (SUBSTITUA pelo seu email e auth_user_id)
-- Primeiro, pegue seu auth_user_id:
SELECT id, email FROM auth.users WHERE email = 'SEU-EMAIL-AQUI@exemplo.com';

-- Depois, crie o registro:
INSERT INTO dim_usuarios (id, email, "nomeCompleto", "auth_user_id", perfil, ativo, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'SEU-EMAIL-AQUI@exemplo.com',
  'Seu Nome',
  'AUTH_USER_ID_AQUI', -- Cole o ID do passo anterior
  'admin_bim',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  perfil = 'admin_bim',
  "auth_user_id" = EXCLUDED."auth_user_id";
```

### 4. Ou use a função RPC (mais fácil):

```sql
-- Execute como o usuário autenticado (após fazer login)
SELECT ensure_dim_usuario();

-- Depois torne admin:
UPDATE dim_usuarios 
SET perfil = 'admin_bim' 
WHERE "auth_user_id" = auth.uid();
```

### 5. Recarregue a página

Após executar os comandos acima:
1. Recarregue a página (F5)
2. Clique no botão 🔄 (refresh) que aparece no cabeçalho
3. A engrenagem deve aparecer!

## Verificação Rápida

No console do navegador (F12), você deve ver:
- ✅ `authMe: Usuário encontrado em dim_usuarios`
- ✅ `authMe: Role mapeado: admin_bim`
- ✅ `isAdmin: true`

Se aparecer `⚠️ NÃO É ADMIN`, significa que o perfil no banco não está como `admin_bim`.

