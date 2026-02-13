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

### Vercel e outros ambientes

O projeto **não** usa `vercel.json` para crons. Use cron externo (cron-job.org, Upstash QStash, GitHub Actions, etc.) ou cron do sistema:

```bash
*/15 * * * * curl -X POST "https://seu-dominio.com/api/sync/tax-form" -H "x-cron-secret: $CRON_SECRET"
```

Configure `CRON_SECRET` nas variáveis de ambiente. O endpoint aceita `x-cron-secret` ou `Authorization: Bearer`. Veja `docs/DEPLOY_VERCEL.md` para detalhes.

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
| Total Assets, Ativos totais da empresa até 31 de dezembro, ativos_totais_ate_31_dez_usd | totalAssetsUsdCents |
| Has US Bank Accounts, Possui contas bancárias nos EUA em nome da LLC, possui_contas_bancarias_nos_eua_em_nome_da_llc | hasUsBankAccounts (SIM/NÃO) |
| Valor total transferido para LLC, total_transferido_pessoalmente_para_llc_usd | totalTransferredToLlcUsdCents |
| Valor total retirado da LLC, total_retirado_pessoalmente_da_llc_usd | totalWithdrawnFromLlcUsdCents |
| Despesas pessoais pagas com fundos comerciais, despesas_pessoais_pagas_com_fundos_comerciais_usd | personalExpensesPaidByCompanyUsdCents |
| Despesas comerciais pagas com fundos pessoais, despesas_comerciais_pagas_com_fundos_pessoais_usd | businessExpensesPaidPersonallyUsdCents |
| owner_2_email, owner_2_full_legal_name, ... | Sócios adicionais (2–5) |
| Endereço residencial diferente, endereco_residencial_diferente_da_empresa | ownerHomeAddressDifferent |
| Endereço residencial linha 1, endereco_residencial_linha_1 | ownerResidentialAddressLine1 |
| Endereço residencial linha 2, endereco_residencial_linha_2 | ownerResidentialAddressLine2 |
| Cidade residencial, cidade_residencial | ownerResidentialCity |
| Estado residencial, estado_residencial | ownerResidentialState |
| CEP residencial, cep_residencial | ownerResidentialPostalCode |
| País residencial, pais_residencial | ownerResidentialCountry |
| Dirección particular (Si es diferente...) - Dirección / Dirección (Línea 2) / Ciudad / Estado / Código Postal / País | ownerResidentialAddressLine1, Line2, City, State, PostalCode, Country |

**Nota endereço residencial:** Os campos de endereço residencial só são persistidos quando `ownerHomeAddressDifferent` (endereço residencial diferente) é true. Caso contrário, são zerados. Se os campos de endereço residencial forem preenchidos mas a pergunta "é diferente?" não estiver na planilha, o sistema infere automaticamente `ownerHomeAddressDifferent = true`.

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
