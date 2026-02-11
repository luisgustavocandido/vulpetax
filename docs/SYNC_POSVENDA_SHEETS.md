# Sincronização Pós-Venda LLC via Google Sheets

Sincroniza a planilha de Pós-Venda LLC com clients, client_line_items e client_partners. Reutiliza a infraestrutura do sync TAX (Service Account, sync_state, import_history).

## 1. Configuração

Reutilize o mesmo Service Account e credenciais do sync TAX. Adicione as variáveis de ambiente:

```env
# Pós-Venda (usa GOOGLE_SERVICE_ACCOUNT_EMAIL + PRIVATE_KEY + CRON_SECRET)
POSVENDA_SHEETS_SPREADSHEET_ID=1Ei9G-lhTmAVOk7ItJy89A_HohhUpWhgz8kZfG_xDc6w
POSVENDA_SHEETS_GID=1004562294
# Opcional:
# POSVENDA_SHEETS_SHEET_NAME=NomeDaAba
```

Compartilhe a planilha com o email da Service Account (Editor ou Leitor).

## 2. Mapeamento

| Coluna (normalizada) | Campo |
|---------------------|-------|
| Empresa | companyName |
| Nº | customerCode |
| Pagamento | paymentDate |
| Comercial | commercial |
| SDR | sdr |
| Tipo de negócio | businessType |
| Forma de Pgto | paymentMethod |
| Anônimo | anonymous |
| Holding | holding |
| Filiado | affiliate |
| Express | express |
| Observação | notes |
| LLC + Pacote | line_item LLC |
| Endereço + Mailing + Second Line | line_item Endereco |
| Gateway | line_item Gateway |
| Serv. Adicional | line_item ServicoAdicional |
| Banco Tradicional | line_item BancoTradicional |
| Mensalidade + Modalidade | line_item Mensalidade |
| Sócio principal (Given Name + Sur Name) | partner SocioPrincipal |
| Sócios 2–5 | partners Socio |
| Porcentagem 1..5 | percentage |

## 3. Sync manual (CLI / Cron)

Use apenas o header `x-cron-secret`. Não use `?secret=` na URL (removido por segurança).

```bash
# Dry run (valida sem gravar)
curl -X POST "https://seu-dominio.com/api/sync/posvenda-llc?dryRun=1" \
  -H "x-cron-secret: SEU_CRON_SECRET"

# Sync real
curl -X POST "https://seu-dominio.com/api/sync/posvenda-llc" \
  -H "x-cron-secret: SEU_CRON_SECRET"
```

## 4. Sincronização manual na UI (Preview + Confirm)

Usuários autenticados (passcode) podem disparar o sync manualmente na página `/clients`:

### Fluxo

1. Acesse `/clients` (após fazer login com passcode)
2. Na seção "Sincronização Google Sheets (Pós-Venda LLC)", clique em **Pré-visualizar sincronização**
3. O sistema busca a planilha e exibe:
   - Contagens: linhas lidas, válidas, inválidas
   - Ações previstas: criar / atualizar / ignorar
   - Até 10 erros (linha, campo, mensagem)
   - Amostra de 3 clientes com a ação esperada
4. Marque "Entendo que isso vai atualizar a base"
5. Clique em **Confirmar sincronização**
6. A lista é atualizada automaticamente

### Endpoints internos (protegidos por passcode)

- **POST /api/clients/sync/preview** — fetch + buildPreview, não grava
- **POST /api/clients/sync/confirm** — fetch + applyPosVendaSync, grava
- **GET /api/clients/sync-status** — último sync e status

Não usam `CRON_SECRET`; o cron continua em `/api/sync/posvenda-llc`.

### Restrições

- **Rate limit**: preview e confirm independentes, 1 req/min por IP cada
- **Lock**: enquanto um sync estiver rodando (`lastRunStatus = RUNNING`), outro confirm é bloqueado (409)
- **Timeout**: 2 minutos por requisição

## 5. Cron

O `vercel.json` está configurado para rodar a cada 15 minutos (mesmo schedule do TAX).

## 6. Comportamento

- **Upsert**: clientes encontrados por `customerCode` (coluna Nº) ou por `companyNameNormalized`
- **customerCode**: se Nº não existir ou for vazio, usa `PV-{hash(nome)}` (determinístico)
- **Deduplicação**: `resolveNameDuplicates` consolida clientes com mesmo nome
- **Items**: replace-all apenas se houver >= 1 item mapeado
- **Partners**: replace-all apenas se houver >= 1 parceiro
- **Auditoria**: clients, line_items e partners registrados em audit_log
