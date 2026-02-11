# Sincronização TAX Form via Google Sheets

Sincroniza respostas do formulário TAX (Google Forms → Google Sheets) com o banco de dados (clients, client_tax_profile, client_tax_owners).

## 1. Criar Service Account no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie ou selecione um projeto
3. Ative a **Google Sheets API** (APIs & Services → Library → Google Sheets API)
4. Crie credenciais:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Nome: ex. `eafc-sheets-sync`
   - Crie uma chave JSON e baixe o arquivo

5. Do arquivo JSON, copie:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` (texto completo, com `\n`) → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

## 2. Compartilhar a planilha

1. Abra a planilha do TAX Form
2. Compartilhe com o **email da Service Account** (ex. `eafc-sheets-sync@projeto.iam.gserviceaccount.com`)
3. Permissão: **Editor** ou **Leitor**

## 3. Configurar variáveis de ambiente

```env
# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@projeto.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Planilha TAX Form
GOOGLE_SHEETS_SPREADSHEET_ID=1fE61l3c8aDGMOUtlMx9RNIlhs-vpJgctI6VMwOEqx3s
GOOGLE_SHEETS_GID=129689283
# Opcional, fallback se gid não funcionar:
# GOOGLE_SHEETS_SHEET_NAME=Nome da aba

# Proteção do endpoint de sync
CRON_SECRET=seu-secret-forte
```

## 4. Rodar sync manual

```bash
# Dry run (valida sem gravar)
curl -X POST "https://seu-dominio.com/api/sync/tax-form?dryRun=1" \
  -H "x-cron-secret: seu-secret-forte"

# Sync real
curl -X POST "https://seu-dominio.com/api/sync/tax-form" \
  -H "x-cron-secret: seu-secret-forte"
```

**Importante:** O endpoint aceita apenas o header `x-cron-secret`. Não use `?secret=` na URL (removido por segurança).

## 5. Cron automático

### Vercel

O `vercel.json` está configurado para rodar a cada 15 minutos:

```json
{
  "cron": [
    { "path": "/api/sync/tax-form", "schedule": "*/15 * * * *" }
  ]
}
```

Configure `CRON_SECRET` nas variáveis de ambiente do projeto Vercel. O Vercel Cron envia a requisição; use um middleware ou Workflow para passar o secret (ou configure o endpoint para aceitar o `?secret=` na URL).

### Outros ambientes

Use cron do sistema ou um serviço externo (cron-job.org, etc.):

```bash
*/15 * * * * curl -X POST "https://seu-dominio.com/api/sync/tax-form" -H "x-cron-secret: $CRON_SECRET"
```

## 6. Mapeamento de colunas

O mapper reconhece headers normalizados (trim, lowercase, sem acentos, espaços → underscore). Exemplos:

| Coluna na planilha | Campo mapeado |
|--------------------|---------------|
| Nome da Empresa, Empresa, Company Name | companyName (clients) |
| Código Cliente, Customer Code | customerCode (clients) |
| Formation Date, Data Formação | formationDate |
| Activities Description | activitiesDescription |
| EIN, Ein Number | einNumber |
| Owner Email, Email | ownerEmail |
| Owner Full Legal Name | ownerFullLegalName |
| Owner Residence Country | ownerResidenceCountry |
| Owner Citizenship Country | ownerCitizenshipCountry |
| Total Assets, Total Assets USD | totalAssetsUsdCents |
| Has US Bank Accounts | hasUsBankAccounts |
| Aggregate Balance Over 10k | aggregateBalanceOver10k |
| owner_2_email, owner_2_full_legal_name, ... | Sócios adicionais (2–5) |

## 7. Comportamento

- **Upsert**: clientes são encontrados por `customerCode` (se existir) ou por `companyNameNormalized`
- **Código determinístico**: quando não há customerCode na planilha, usa `TAX-{hash(companyNameNormalized)}`
- **Sem duplicação**: `resolveNameDuplicates` consolida clientes com mesmo nome
- **Idempotente**: rodar várias vezes não duplica registros
- **Origem**: `taxFormSource = "google_sheets_tax_form"` e `taxFormSubmittedAt` são atualizados em cada sync

## 8. Aba /tax

A listagem em `/tax` exibe **apenas** clientes com `taxFormSource = "google_sheets_tax_form"`. O badge "Fonte: Google Sheets TAX Form" indica a origem dos dados.

## 9. Sincronização manual (Preview + Confirm)

Usuários autenticados (passcode) podem disparar o sync manualmente na página `/tax`, em duas etapas:

### Fluxo

1. Acesse `/tax` (após fazer login com passcode)
2. Clique em **Pré-visualizar sincronização**
3. O sistema busca a planilha e exibe uma prévia:
   - Contagens: linhas lidas, válidas, inválidas
   - Ações previstas: criar / atualizar / ignorar
   - Até 10 erros (linha, campo, mensagem)
   - Amostra de 3 clientes com a ação esperada
4. Se desejar prosseguir, marque o checkbox "Entendo que isso vai atualizar a base"
5. Clique em **Confirmar sincronização**
6. O sistema grava no banco e exibe o resultado
7. A lista é atualizada automaticamente (`router.refresh`)

### Endpoints internos (protegidos por passcode)

- **POST /api/tax/sync/preview** — executa `fetch + buildPreview`, não grava
- **POST /api/tax/sync/confirm** — executa `fetch + applyTaxFormSync`, grava `import_history` e `sync_state`

Não usam `CRON_SECRET`; o cron continua em `/api/sync/tax-form`.

### Restrições

- **Rate limit**: preview e confirm independentes, 1 req/min por IP cada
- **Lock**: enquanto um sync estiver rodando (`lastRunStatus = RUNNING`), outro confirm é bloqueado (409)
- **Timeout**: 2 minutos por requisição

### Status

O texto "Último sync: … · Status: …" exibe a última execução e o status (ok/error).
