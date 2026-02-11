# Segurança — EAFC (Next.js + Drizzle + Postgres)

Documento de referência para políticas de segurança e hardening aplicado.

## Variáveis de ambiente necessárias

```env
# Autenticação
PASSCODE=xxx          # Passcode atual (obrigatório)
PASSCODE_PREVIOUS=yyy # Passcode anterior (opcional, para rotação)
SESSION_SECRET=zzz    # Chave para assinatura do cookie de sessão (32+ bytes hex)

# Banco de dados
DATABASE_URL=postgresql://...

# Sync cron (Vercel Cron, etc.)
CRON_SECRET=xxx       # Header x-cron-secret obrigatório para /api/sync/*

# Google Sheets (sync TAX e Pós-Venda)
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="..."
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_GID=...
POSVENDA_SHEETS_SPREADSHEET_ID=...
POSVENDA_SHEETS_GID=...
```

## Headers HTTP globais

Configurados em `next.config.mjs` para todas as rotas:

| Header | Valor |
|--------|-------|
| X-Content-Type-Options | nosniff |
| Referrer-Policy | no-referrer |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=(), usb=(), etc. |
| X-Frame-Options | DENY |
| Content-Security-Policy | default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://www.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload (somente produção) |

## Cache-Control para páginas privadas

Rotas `/clients`, `/dashboard`, `/tax` usam `Cache-Control: no-store` via middleware.

## Políticas de rate limit

| Endpoint | Limite | Janela |
|----------|--------|--------|
| POST /api/passcode-login | 5 tentativas | 15 min |
| POST /api/tax/sync/preview | 1 req | 1 min |
| POST /api/tax/sync/confirm | 1 req | 1 min |
| POST /api/clients/sync/preview | 1 req | 1 min |
| POST /api/clients/sync/confirm | 1 req | 1 min |
| DELETE /api/clients/[id]/tax | 5 req | 1 hora |

## Proteção de endpoints sensíveis

### Sync cron

- **Endpoints:** `/api/sync/tax-form`, `/api/sync/posvenda-llc`
- **Autenticação:** apenas header `x-cron-secret` (igual a `CRON_SECRET`)
- **Query param `?secret=` removido** — não aceita mais autenticação por URL
- **Lock:** Postgres advisory lock — se outro sync estiver rodando, responde 409 `sync_already_running`
- **Método:** POST

### Import CSV

- **Content-Type:** obrigatório `multipart/form-data`
- **Tamanho máximo:** 5MB
- **Linhas máximo:** 20.000
- **Método:** POST

### Querystring

- `limit` / `pageSize` limitado a máximo 100

### Inputs text (Zod)

- `notes`, `description`, `activitiesDescription`, endereços: máximo 2000 caracteres

## Lock de concorrência (sync)

Postgres `pg_try_advisory_lock` / `pg_advisory_unlock`:

- **Chaves:** taxForm (0x5441585f53594e43), posvenda (0x504f535653594e43)
- **Uso:** cron e confirm compartilham a mesma chave por tipo
- **Liberação:** sempre em `finally`, e automaticamente ao fechar conexão

## Rotação do passcode

1. Defina `PASSCODE` com o novo valor
2. Opcionalmente defina `PASSCODE_PREVIOUS` com o valor antigo (permite sessões antigas por um período)
3. Reinicie o app
4. Usuários precisam fazer login novamente com o novo passcode

## Como rodar sync com segurança

### Cron (produção)

O endpoint aceita `x-cron-secret` ou `Authorization: Bearer <CRON_SECRET>`. Configure o cron para enviar um deles:

```bash
# Com Bearer (recomendado para Vercel)
curl -X POST "https://seu-dominio.com/api/sync/tax-form" \
  -H "Authorization: Bearer $CRON_SECRET"

# Com x-cron-secret (testes locais)
curl -X POST "https://seu-dominio.com/api/sync/tax-form" \
  -H "x-cron-secret: $CRON_SECRET"
```

Ou para Pós-Venda:

```bash
curl -X POST "https://seu-dominio.com/api/sync/posvenda-llc" \
  -H "x-cron-secret: $CRON_SECRET"
```

**Dry run** (valida sem gravar):

```bash
curl -X POST "https://seu-dominio.com/api/sync/tax-form?dryRun=1" \
  -H "x-cron-secret: $CRON_SECRET"
```

### Manual (UI)

1. Faça login com passcode
2. Acesse `/tax` ou `/clients`
3. Clique em "Pré-visualizar sincronização"
4. Revise a prévia e clique em "Confirmar sincronização"

## Sanitização de erros

- Em **produção**, mensagens de erro retornadas ao cliente são genéricas (`Erro interno. Verifique os logs.`)
- Stack traces e detalhes técnicos não são expostos
- Secrets nunca são logados (ver `sanitizeForLog`)

## Logger de segurança

`src/lib/logger.ts` — `logSecurityEvent(type, data)`:

- `login_rate_limited` — IP excedeu limite de login
- `sync_manual_attempt` — sync manual disparado (type: tax_form | posvenda)
- `sync_failed` — sync falhou (type, error resumido)
- `tax_remove` — TAX removido (clientId)
- `import_failed` — import com erros (filename, rowsErrors)

Em produção, saída em JSON por linha (console).

## Recomendações de deploy

1. **HTTPS obrigatório** — nunca servir em HTTP em produção
2. **Banco gerenciado** — usar Postgres gerenciado (Vercel Postgres, Neon, Supabase, etc.)
3. **Backups** — configurar backups automáticos do banco
4. **Variáveis sensíveis** — nunca commitar `.env`; usar secrets da plataforma
5. **Rotação** — rotacionar `CRON_SECRET`, `SESSION_SECRET` e passcode periodicamente
6. **Monitoramento** — coletar logs de `logSecurityEvent` para análise

## Testes manuais (curl)

### 1. Headers de segurança

```bash
curl -I https://seu-dominio.com/
```

Verificar presença de: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Content-Security-Policy`.

### 2. Sync sem secret — 401

```bash
curl -X POST "https://seu-dominio.com/api/sync/tax-form" -w "\n%{http_code}\n"
# Esperado: 401
```

### 3. Sync com secret inválido — 401

```bash
curl -X POST "https://seu-dominio.com/api/sync/tax-form" \
  -H "x-cron-secret: wrong" -w "\n%{http_code}\n"
# Esperado: 401
```

### 4. Import sem multipart — 400

```bash
curl -X POST "https://seu-dominio.com/api/clients/import" \
  -H "Content-Type: application/json" \
  -d '{}' -w "\n%{http_code}\n"
# Esperado: 400 (Content-Type deve ser multipart/form-data)
```

### 5. Login rate limit (após 5 tentativas inválidas)

```bash
# Executar 6 vezes com passcode errado
for i in {1..6}; do
  curl -s -X POST "https://seu-dominio.com/api/passcode-login" \
    -F "passcode=wrong" -w "%{http_code}\n" -o /dev/null
done
# Esperado: redirecionamento para /login?error=rate_limit após limite
```

### 6. Cache-Control em páginas privadas

```bash
curl -I "https://seu-dominio.com/clients" -H "Cookie: ..."
# Verificar: Cache-Control: no-store
```
