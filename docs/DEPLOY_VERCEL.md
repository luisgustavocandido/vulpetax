# Deploy na Vercel com Postgres remoto

Passo a passo para deploy do EAFC na Vercel usando Postgres gerenciado (Neon, Supabase, etc.).

## Pré-requisitos

- Conta Vercel
- Conta Neon ou Supabase (Postgres)
- Projeto no GitHub conectado à Vercel

---

## 1. Criar Postgres remoto

### Opção A: Neon

1. Acesse [neon.tech](https://neon.tech) e crie um projeto
2. Copie a **connection string** (Connection string → Pooled)
3. A URL já inclui `?sslmode=require` para SSL

### Opção B: Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Settings → Database → Connection string → URI
3. Use a string **pooled** (Transaction) para serverless
4. Adicione `?sslmode=require` se não estiver presente

---

## 2. Configurar variáveis na Vercel

No projeto Vercel → Settings → Environment Variables, adicione:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `DATABASE_URL` | Connection string do Postgres | Sim |
| `PASSCODE` | Passcode para login (também usado para assinar cookie de sessão) | Sim |
| `CRON_SECRET` | Secret para endpoints de sync | Sim |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email da Service Account | Para sync TAX |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Chave privada (com `\n`) | Para sync TAX |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID da planilha TAX | Para sync TAX |
| `GOOGLE_SHEETS_GID` | ID da aba TAX | Para sync TAX |
| `POSVENDA_SHEETS_SPREADSHEET_ID` | ID da planilha Pós-Venda | Para sync Clientes |
| `POSVENDA_SHEETS_GID` | ID da aba Pós-Venda | Para sync Clientes |

**Importante:** Selecione **Production**, **Preview** e **Development** conforme necessário.

---

## 3. Rodar migrações apontando para o remoto

Antes ou depois do primeiro deploy, rode as migrações localmente usando o banco remoto:

```bash
# Temporariamente use o DATABASE_URL do remoto
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
npm run db:migrate
```

Ou crie um `.env.production.local` com o `DATABASE_URL` do Neon/Supabase e rode:

```bash
npm run db:migrate
```

---

## 4. Deploy

1. Conecte o repositório à Vercel
2. Configure as variáveis de ambiente
3. Faça o deploy (git push ou Deploy na dashboard)

---

## 5. Configurar Cron

O `vercel.json` já define os crons:

```json
{
  "cron": [
    { "path": "/api/sync/tax-form", "schedule": "*/15 * * * *" },
    { "path": "/api/sync/posvenda-llc", "schedule": "*/15 * * * *" }
  ]
}
```

### Autenticação do Cron

O Vercel Cron envia requisições HTTP. O app aceita:

- **`x-cron-secret`:** valor igual a `CRON_SECRET` (testes locais)
- **`Authorization: Bearer <CRON_SECRET>`** (recomendado para Vercel)

O Vercel Cron padrão **não** envia headers customizados automaticamente. Para enviar `Authorization: Bearer`:

1. Use **Vercel Cron Jobs** (plano Pro) que permite configurar headers, ou
2. Use um serviço externo (cron-job.org, Upstash QStash, etc.) configurando:
   - URL: `https://seu-app.vercel.app/api/sync/tax-form`
   - Header: `Authorization: Bearer <CRON_SECRET>`

Para testes locais:

```bash
curl -X POST "http://localhost:3000/api/sync/tax-form" \
  -H "x-cron-secret: SEU_CRON_SECRET"
```

---

## 6. SSL do Postgres

As connection strings do Neon e Supabase geralmente já incluem `?sslmode=require`. O driver `pg` usa SSL automaticamente quando configurado na URL.

Se a URL remota não tiver `sslmode` e a conexão falhar, adicione:

```
postgresql://...?sslmode=require
```

---

## Checklist de validação pós-deploy

- [ ] Aplicação carrega em `https://seu-app.vercel.app`
- [ ] Login com passcode funciona
- [ ] Páginas protegidas (`/clients`, `/dashboard`, `/tax`) exigem login
- [ ] Headers de segurança presentes (`curl -I` em qualquer rota)
- [ ] Sync manual (prévia + confirm) em `/tax` e `/clients` funcionam
- [ ] Cron executando (ver logs na Vercel ou em `/api/health`)
- [ ] `DATABASE_URL` aponta para Postgres remoto (não localhost)
- [ ] Variáveis sensíveis (`CRON_SECRET`, `PASSCODE`) configuradas na Vercel

### Teste rápido do cron

```bash
# Com Bearer (produção)
curl -X POST "https://seu-app.vercel.app/api/sync/tax-form" \
  -H "Authorization: Bearer SEU_CRON_SECRET" -w "\n%{http_code}\n"

# Com x-cron-secret (alternativa)
curl -X POST "https://seu-app.vercel.app/api/sync/tax-form" \
  -H "x-cron-secret: SEU_CRON_SECRET" -w "\n%{http_code}\n"
```

Resposta esperada: `200` com JSON de resultado ou `409` se sync já em execução.
