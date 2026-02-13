# Rollback: Supabase → Neon + Otimização de Performance

Guia completo para fazer rollback do banco de Supabase para Neon e estabilizar produção.

---

## 1. Como o App Usa DATABASE_URL

### Confirmação da Documentação

✅ **O app usa apenas `DATABASE_URL`** (genérico, compatível com qualquer Postgres):
- `src/db/index.ts` - Lê `process.env.DATABASE_URL`
- `drizzle.config.ts` - Usa `process.env.DATABASE_URL` para migrações
- Não há variáveis específicas de provedor (Supabase/Neon)
- Formato genérico: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

### Arquivos que Usam DATABASE_URL

- `src/db/index.ts` - Conexão principal do Drizzle
- `src/db/reset.ts` - Script de reset (detecta remoto por hostname)
- `drizzle.config.ts` - Configuração do Drizzle Kit
- Scripts temporários (`apply-prod-migration.ts`, `check-prod-sync-state.ts`)

**Conclusão:** Apenas `DATABASE_URL` precisa ser trocada. Nenhuma outra variável específica de provedor.

---

## 2. Variáveis de Ambiente na Vercel

### Variáveis que Precisam ser Atualizadas

| Variável | Ação | Onde Atualizar |
|----------|------|----------------|
| `DATABASE_URL` | **TROCAR** (Supabase → Neon) | Production + Preview |
| `PASSCODE` | Manter | - |
| `PASSCODE_CURRENT` | Manter (se existir) | - |
| `PASSCODE_PREVIOUS` | Manter (se existir) | - |
| `CRON_SECRET` | Manter | - |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Manter | - |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Manter | - |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Manter | - |
| `GOOGLE_SHEETS_GID` | Manter | - |
| `POSVENDA_SHEETS_SPREADSHEET_ID` | Manter | - |
| `POSVENDA_SHEETS_GID` | Manter | - |

### Passos para Atualizar na Vercel

1. **Acessar Vercel Dashboard:**
   - Projeto → Settings → Environment Variables

2. **Atualizar `DATABASE_URL` em Production:**
   - Editar variável `DATABASE_URL`
   - Substituir connection string do Supabase pela do Neon
   - Formato Neon: `postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`
   - **Importante:** Usar connection string do modo **Serverless** (não Session)

3. **Atualizar `DATABASE_URL` em Preview:**
   - Repetir o mesmo processo para Preview
   - Pode usar a mesma connection string ou uma diferente (staging)

4. **Redeploy:**
   - Vercel Dashboard → Deployments → Redeploy (Production)
   - Ou fazer push de um commit para trigger automático

---

## 3. Checklist de Validação Pós-Rollback

### Pré-Rollback (Preparação)

- [ ] Connection string do Neon obtida (modo Serverless)
- [ ] Migrações aplicadas no Neon (`npm run db:migrate` com `DATABASE_URL` do Neon)
- [ ] Backup do Supabase criado (opcional, mas recomendado)
- [ ] `DATABASE_URL` atualizada na Vercel (Production + Preview)

### Validação Imediata (Após Redeploy)

#### 3.1 Health Check
```bash
curl https://vulpetax.vercel.app/api/health
```
**Esperado:** `200` com JSON `{ "status": "ok", "database": "connected" }`

#### 3.2 Autenticação
- [ ] Acessar `https://vulpetax.vercel.app/login`
- [ ] Fazer login com passcode
- [ ] Cookie de sessão criado (DevTools → Application → Cookies)
- [ ] Redirecionamento para `/clients` funciona

#### 3.3 Página de Clientes
- [ ] Acessar `https://vulpetax.vercel.app/clients` (após login)
- [ ] Página carrega **sem loop** de redirect
- [ ] Lista de clientes renderiza corretamente
- [ ] Paginação funciona (se houver múltiplas páginas)

#### 3.4 API de Clientes
```bash
# Com cookie de sessão (após login no browser)
curl https://vulpetax.vercel.app/api/clients \
  -H "Cookie: vulpeinc_session=..." \
  -w "\n%{http_code}\n"
```
**Esperado:** `200` com JSON de lista de clientes

```bash
# Sem cookie (deve retornar 401)
curl https://vulpetax.vercel.app/api/clients -w "\n%{http_code}\n"
```
**Esperado:** `401` com `{"error":"Não autenticado"}`

#### 3.5 Logs da Vercel
- [ ] Vercel Dashboard → Deployments → [último deploy] → Functions
- [ ] Verificar logs: **não deve haver**:
  - Erros de conexão (`ECONNREFUSED`, `ETIMEDOUT`)
  - Erros de autenticação (`password authentication failed`)
  - Erros SSL (`SSL connection required`)
  - `401` repetidos em `/api/clients` (indicando loop)

#### 3.6 Funcionalidades Críticas
- [ ] Dashboard carrega (`/dashboard`)
- [ ] TAX carrega (`/tax`)
- [ ] Sync status funciona (`/api/clients/sync-status`, `/api/tax/sync-status`)
- [ ] Filtros de clientes funcionam (busca, comercial, etc.)

### Validação de Performance

- [ ] Tempo de resposta `/api/clients` < 500ms (verificar Network tab)
- [ ] Tempo de resposta `/clients` (page load) < 2s
- [ ] Sem timeouts ou erros `504 Gateway Timeout`

---

## 4. Diagnóstico de Lentidão no Neon

### 4.1 Query Mais Lenta Identificada

A query mais lenta é a **listagem de clientes com soma de line_items**:

**Arquivo:** `src/lib/clientsQuery.ts`

**Query atual:**
```sql
SELECT 
  clients.id,
  clients.company_name,
  clients.customer_code,
  clients.payment_date,
  clients.commercial,
  clients.payment_method,
  COALESCE(line_items_totals.total_cents, 0)::int AS total_cents
FROM clients
LEFT JOIN (
  SELECT 
    client_id,
    COALESCE(SUM(value_cents), 0)::int AS total_cents
  FROM client_line_items
  GROUP BY client_id
) AS line_items_totals ON line_items_totals.client_id = clients.id
WHERE clients.deleted_at IS NULL
ORDER BY clients.created_at DESC
LIMIT 20
OFFSET 0
```

**Problemas potenciais:**
1. Subquery agregada executa para cada linha (mesmo com LEFT JOIN)
2. Falta índice em `client_line_items.client_id`
3. Falta índice em `clients.created_at` (ORDER BY)
4. Falta índice em `clients.deleted_at` (WHERE)

### 4.2 Índices Recomendados

#### Índices Críticos (Criar Imediatamente)

```sql
-- Índice para JOIN em client_line_items
CREATE INDEX IF NOT EXISTS idx_client_line_items_client_id 
ON client_line_items(client_id);

-- Índice para ORDER BY em clients
CREATE INDEX IF NOT EXISTS idx_clients_created_at_desc 
ON clients(created_at DESC) 
WHERE deleted_at IS NULL;

-- Índice para WHERE em clients
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at_null 
ON clients(deleted_at) 
WHERE deleted_at IS NULL;

-- Índice composto para query completa (otimização adicional)
CREATE INDEX IF NOT EXISTS idx_clients_query_optimized 
ON clients(created_at DESC, deleted_at) 
WHERE deleted_at IS NULL;
```

#### Índices Adicionais (Se houver filtros frequentes)

```sql
-- Se filtro por commercial for frequente
CREATE INDEX IF NOT EXISTS idx_clients_commercial 
ON clients(commercial) 
WHERE deleted_at IS NULL;

-- Se filtro por payment_method for frequente
CREATE INDEX IF NOT EXISTS idx_clients_payment_method 
ON clients(payment_method) 
WHERE deleted_at IS NULL;
```

### 4.3 Otimização da Query

A query atual já usa subquery agregada + LEFT JOIN, que é eficiente. Mas podemos melhorar:

**Opção A: Manter subquery (recomendado)**
- ✅ Já implementado
- ✅ Evita problemas com GROUP BY
- ✅ Performance boa com índices

**Opção B: Materialized View (se dados mudam pouco)**
```sql
CREATE MATERIALIZED VIEW mv_client_totals AS
SELECT 
  client_id,
  COALESCE(SUM(value_cents), 0)::int AS total_cents
FROM client_line_items
GROUP BY client_id;

CREATE UNIQUE INDEX ON mv_client_totals(client_id);

-- Refresh periódico (via cron ou trigger)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_totals;
```

**Opção C: Coluna calculada (se soma muda pouco)**
- Adicionar `total_cents` como coluna em `clients`
- Atualizar via trigger quando `client_line_items` muda
- Mais complexo, mas mais rápido para leitura

### 4.4 Configuração de Pooling/Conexão Serverless

#### Neon Serverless Connection

**Formato da connection string:**
```
postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

**Características:**
- ✅ Pooling automático (não precisa configurar manualmente)
- ✅ Conexões serverless otimizadas
- ✅ Auto-scaling de conexões

**Configuração no código (`src/db/index.ts`):**
```typescript
// Já está correto - usa connection string diretamente
export const db = drizzle(connectionString, { schema });
```

**Não é necessário:**
- ❌ Configurar pool manualmente (`pg.Pool`)
- ❌ Definir `max` ou `min` connections
- ❌ Gerenciar timeouts manualmente (Neon gerencia)

#### Verificação de Pooling

Para verificar se pooling está funcionando:

```sql
-- Ver conexões ativas (no Neon Dashboard → SQL Editor)
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start DESC;
```

**Esperado:**
- Múltiplas conexões com `application_name` diferente (indicando pooling)
- Conexões de curta duração (serverless)

---

## 5. Scripts de Aplicação de Índices

### Script para Criar Índices no Neon

Crie `apply-performance-indexes.ts`:

```typescript
import "dotenv/config";
import { Pool } from "pg";

async function applyIndexes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_client_line_items_client_id 
     ON client_line_items(client_id);`,
    
    `CREATE INDEX IF NOT EXISTS idx_clients_created_at_desc 
     ON clients(created_at DESC) 
     WHERE deleted_at IS NULL;`,
    
    `CREATE INDEX IF NOT EXISTS idx_clients_deleted_at_null 
     ON clients(deleted_at) 
     WHERE deleted_at IS NULL;`,
    
    `CREATE INDEX IF NOT EXISTS idx_clients_query_optimized 
     ON clients(created_at DESC, deleted_at) 
     WHERE deleted_at IS NULL;`,
  ];

  try {
    for (const sql of indexes) {
      await pool.query(sql);
      console.log(`✅ Índice criado: ${sql.substring(0, 50)}...`);
    }
    console.log("\n✅ Todos os índices foram criados com sucesso!");
  } catch (error: any) {
    console.error("❌ Erro ao criar índices:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applyIndexes();
```

**Uso:**
```bash
DATABASE_URL="postgresql://...neon..." npx tsx apply-performance-indexes.ts
```

---

## 6. Passos Exatos para Rollback

### Passo 1: Preparar Neon

1. Criar projeto no Neon (se ainda não existe)
2. Obter connection string (modo Serverless)
3. Aplicar migrações:
   ```bash
   export DATABASE_URL="postgresql://...neon..."
   npm run db:migrate
   ```
4. Aplicar índices de performance:
   ```bash
   DATABASE_URL="postgresql://...neon..." npx tsx apply-performance-indexes.ts
   ```

### Passo 2: Atualizar Vercel

1. Vercel Dashboard → Projeto → Settings → Environment Variables
2. Editar `DATABASE_URL` (Production):
   - Remover connection string do Supabase
   - Adicionar connection string do Neon
3. Editar `DATABASE_URL` (Preview):
   - Repetir processo
4. **NÃO deletar** outras variáveis (PASSCODE, CRON_SECRET, etc.)

### Passo 3: Redeploy

1. Vercel Dashboard → Deployments → Redeploy (Production)
2. Ou fazer push de commit vazio:
   ```bash
   git commit --allow-empty -m "chore: rollback para Neon"
   git push
   ```

### Passo 4: Validação

Seguir checklist da seção 3 acima.

---

## 7. Troubleshooting

### Erro: "password authentication failed"
- Verificar se connection string do Neon está correta
- Verificar se senha está URL-encoded (se tiver caracteres especiais)

### Erro: "SSL connection required"
- Adicionar `?sslmode=require` ao final da connection string

### Erro: "relation does not exist"
- Migrações não foram aplicadas no Neon
- Rodar `npm run db:migrate` com `DATABASE_URL` do Neon

### Performance ainda lenta após índices
- Verificar se índices foram criados: `\d+ clients` no Neon SQL Editor
- Verificar EXPLAIN da query: adicionar `EXPLAIN ANALYZE` antes da query
- Considerar materialized view se dados mudam pouco

---

## 8. Monitoramento Pós-Rollback

### Métricas para Acompanhar

1. **Tempo de resposta:**
   - `/api/clients` < 500ms
   - `/clients` (page load) < 2s

2. **Taxa de erro:**
   - Health check: 0% de falhas
   - API endpoints: < 1% de 500

3. **Conexões:**
   - Verificar no Neon Dashboard → Metrics
   - Conexões ativas devem ser baixas (serverless)

### Alertas Recomendados

- Vercel: Alertas para 500 errors > 1%
- Neon: Alertas para conexões > limite
- Custom: Monitorar tempo de resposta `/api/clients`

---

## Resumo Executivo

| Item | Ação |
|------|------|
| **Variável a trocar** | `DATABASE_URL` (Production + Preview) |
| **Outras variáveis** | Manter todas (PASSCODE, CRON_SECRET, etc.) |
| **Migrações** | Aplicar no Neon antes do rollback |
| **Índices** | Criar índices de performance após migrações |
| **Validação** | Health check → Login → /clients → API → Logs |
| **Performance** | Subquery + LEFT JOIN já otimizado; adicionar índices |

**Tempo estimado:** 30-60 minutos (incluindo validação)
