# Módulo Cobranças (/billing)

Cobranças de itens do tipo **Endereço** (Mensal/Anual), com listagem, filtros e ações (marcar pago, cancelar, reabrir).

## Visão geral

- **Rota:** `/billing`
- **Fonte de dados:** `clients` + `client_line_items` (kind = "Endereco") + `billing_charges`
- O módulo **não edita clientes**; apenas lista cobranças e permite marcar pago/cancelar/reabrir.

## Banco de dados

### Tabela `billing_charges`

| Coluna         | Tipo      | Descrição |
|----------------|-----------|-----------|
| id             | uuid (pk) | |
| client_id      | uuid (fk → clients) | |
| line_item_id   | uuid (fk → client_line_items) | |
| period_start   | date | Início do período cobrado |
| period_end     | date | Fim do período |
| due_date       | date | Data de expiração do período (fim do período; para anual pode ser expirationDate) |
| amount_cents   | int | Valor em centavos (USD) |
| currency       | varchar(3) | Default 'USD' |
| status         | varchar | pending \| overdue \| paid \| canceled |
| paid_at        | timestamp | Preenchido quando pago |
| paid_method    | text | Método (Stripe, Wise, etc.) |
| provider       | varchar | manual \| stripe |
| notes          | text | |
| created_at, updated_at | timestamp | |

- **UNIQUE:** (line_item_id, period_start, period_end)
- **Índices:** status+due_date, client_id, line_item_id

### Migrações

- `drizzle/0014_billing_charges.sql` — criação da tabela
- `drizzle/0016_billing_charges_paid_method.sql` — coluna `paid_method` e índice em `line_item_id`
- `drizzle/0017_billing_charges_due_date_backfill.sql` — backfill: `due_date = period_end` para pending/overdue (executar: `npx tsx scripts/run-0017-billing-due-date-backfill.ts`)

Aplicar manualmente se necessário:

```bash
npx tsx -e "
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('./drizzle/0016_billing_charges_paid_method.sql','utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(sql).then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"
```

## Engine de cobranças

- **`src/lib/billing/chargesEngine.ts`**
  - `ensureCharges(windowDays)`: garante cobranças para itens Endereço (Mensal/Anual) e atualiza status (pending → overdue quando dueDate &lt; hoje).
  - Helpers: `parseISODate`, `formatISODate`, `addMonthsSafe`, `addYearsSafe` (datas em UTC).
- **`src/lib/billing/generateAddressCharges.ts`**
  - Regras de período ancoradas em `saleDate`; para Anual, respeita `expirationDate` (não gera após expiração).
  - **Vencimento (due_date):** fim do período — Mensal: `due_date = period_end`; Anual: `due_date = expirationDate ?? period_end`. Cobrança “no mês que expira”.
  - Itens elegíveis: kind = "Endereco", billingPeriod not null, valueCents &gt; 0, saleDate not null, client não deletado.

## API

### GET /api/billing/charges

Query: `status`, `period`, `from`, `to`, `q`, `page`, `limit`, `windowDays`.

- Chama `ensureCharges(windowDays)` antes de listar.
- Retorno: `{ data: ChargeRow[], meta: { page, limit, total, totals: { pendingCents, overdueCents, paidCents } } }`.
- Cada `ChargeRow` inclui cliente (companyName, paymentMethod) e lineItem (addressProvider, addressLine1, addressLine2, steNumber).

### POST /api/billing/charges/:id/pay

Body: `paidAt?`, `paidMethod?`, `notes?`.

- 409 se já pago ou cancelado.
- Atualiza status=paid, paidAt, paidMethod, notes.

### POST /api/billing/charges/:id/cancel

Body: `notes?`.

- 409 se já pago. Atualiza status=canceled.

### POST /api/billing/charges/:id/reopen

- Apenas para status=canceled. Define status=pending ou overdue conforme dueDate.

## UI (/billing)

- **Cards:** totais Pendentes, Atrasadas, Pagas (mês atual) a partir de `meta.totals`.
- **Filtros:** Status, Periodicidade (Mensal/Anual), intervalo de datas (dueDate), busca por empresa ou endereço (debounce 300 ms).
- **Tabela:** Empresa (link para /clients/[id]), Endereço (provider + linhas; STE se New Mexico), Periodicidade, Período, Vencimento (destaque se atrasado), Valor, Status, Ações.
- **Ações:** Marcar como pago (modal com data, método, observação), Cancelar, Reabrir (apenas canceladas).
- **Modal de pagamento:** paidAt, paidMethod (Stripe, Wise, Binance, Zelle, Pix, ACH, Paypal, USDT, Revolut, Outro + campo texto), notes.

## Acentos (kind)

No código e no banco, o valor usado é **"Endereco"** (sem acento). As queries de billing filtram por `kind = "Endereco"`.

## Checklist de aceite

1. /billing abre e lista cobranças.
2. Para lineItem Endereço Mensal com saleDate no passado, existe cobrança pending/overdue correta.
3. Marcar como pago: status vira paid e some do filtro pending/overdue.
4. Cancelar: status canceled e aparece no filtro canceladas.
5. Reabrir: canceled → pending/overdue conforme dueDate.
6. Recarregar várias vezes não duplica cobrança (unique constraint).
7. `npm run build` passa.
