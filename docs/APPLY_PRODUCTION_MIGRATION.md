# Aplicar Migração no Banco de Produção

Este guia explica como aplicar a migração `0006_tax_form_sync.sql` (que cria a tabela `sync_state`) no banco de produção.

## Problema

A tabela `sync_state` não existe no banco de produção, causando erro `500` em `/api/clients/sync-status`:

```
error: relation "sync_state" does not exist
```

## Solução

### Opção 1: Script Automático (Recomendado)

Use o script `apply-prod-migration.ts` que verifica e cria a tabela automaticamente:

```bash
# Usando DATABASE_URL do .env (se for produção)
npx tsx apply-prod-migration.ts

# OU especificando DATABASE_URL diretamente
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" npx tsx apply-prod-migration.ts
```

O script:
- ✅ Verifica se a tabela já existe
- ✅ Aplica apenas o que falta
- ✅ Mostra estrutura final da tabela
- ✅ É idempotente (pode rodar múltiplas vezes)

### Opção 2: Via Drizzle Kit

```bash
# Configure DATABASE_URL para produção
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
npm run db:migrate
```

**Nota:** O `drizzle-kit migrate` pode não aplicar corretamente em alguns casos. Se falhar, use a Opção 1.

### Opção 3: SQL Manual

Conecte-se ao banco de produção e execute:

```sql
-- sync_state table for tracking sync runs
CREATE TABLE IF NOT EXISTS "sync_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(100) NOT NULL UNIQUE,
  "last_synced_at" timestamp with time zone,
  "last_run_status" varchar(20),
  "last_run_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

## Onde Pegar DATABASE_URL de Produção?

### Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Selecione seu projeto
3. Settings → Database → Connection string
4. Escolha **URI** no modo **Transaction** (pooler)
5. Copie a URL completa

### Vercel Environment Variables

1. Acesse [vercel.com](https://vercel.com)
2. Selecione seu projeto
3. Settings → Environment Variables
4. Copie o valor de `DATABASE_URL` (Production)

**⚠️ ATENÇÃO:** Não exponha a `DATABASE_URL` em logs ou commits!

## Validação

Após aplicar a migração, valide:

```bash
# Verificar se a tabela existe
DATABASE_URL="..." npx tsx -e "
import 'dotenv/config';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const check = await pool.query(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_state');\");
console.log('sync_state existe:', check.rows[0].exists);
await pool.end();
"
```

Ou teste o endpoint:

```bash
curl https://vulpetax.vercel.app/api/clients/sync-status
```

Deve retornar `200` com JSON (mesmo que vazio) ao invés de `500`.

## Próximos Passos

1. ✅ Aplicar migração no banco de produção
2. ✅ Verificar que `/api/clients/sync-status` retorna `200`
3. ✅ Fazer redeploy na Vercel (opcional, para limpar cache)
4. ✅ Testar `/clients` em produção após login

## Troubleshooting

### Erro: "relation sync_state does not exist"

- A migração não foi aplicada
- Use o script `apply-prod-migration.ts`

### Erro: "permission denied"

- Verifique se a `DATABASE_URL` tem permissões de escrita
- Use uma connection string com usuário que tenha `CREATE TABLE`

### Erro: "SSL required"

- Adicione `?sslmode=require` ao final da `DATABASE_URL`
- Exemplo: `postgresql://...?sslmode=require`
