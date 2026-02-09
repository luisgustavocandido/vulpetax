6# VulpeTax — Blueprint e roadmap

Escopo: **single-member foreign-owned disregarded entity** (Form 5472 + pro forma Form 1120). Controle interno apenas.

---

## 1. Regras fiscais → lógica do produto

Devem virar **checklists automáticos, bloqueios e alertas** no sistema.

| Regra | Implicação no produto |
|-------|------------------------|
| Entidade "foreign-owned U.S. disregarded entity" deve enviar **pro forma Form 1120** com **Form 5472** anexado até o due date (incl. extensões). | **Deadline engine**: prazos federal/estadual, extensão, status, lembretes. |
| Multa: falha em enviar Form 5472 completo/correto → **$25.000 por falha** + **$25.000 a cada 30 dias** após 90 dias do aviso do IRS (sem teto). | **Completeness engine**: o que falta para fechar e enviar; bloqueios até estar completo. |
| Reportability: o que entra no 5472 (transações com related party, aportes, distribuições, loans, fees). | **Reportability engine**: tipagem de transações, related parties, FX. |

- **Reportability engine** — O que entra no 5472 (tipos, related party, valores, FX).
- **Completeness engine** — O que falta para fechar (related party obrigatório, totais, documentos, ano fechado).
- **Deadline engine** — Prazos federal/estado, extensão, status e lembretes.

---

## 2. Modelo de dados

### Já existente
- `clients`, `llcs`, `tax_filings`, `reportable_transactions`.

### A) Entidades e compliance
- **users** — Equipe (email, nome, role).
- **roles** — admin, preparer, reviewer.
- **audit_log** — Quem alterou o quê, quando; antes/depois (JSON).
- **attachments** — Upload: EIN letter, Articles, Operating Agreement, extratos, comprovantes. `entity_type` + `entity_id`.

### B) 5472 “de verdade”
- **related_parties** — Foreign related party (e outros: owner, empresa do owner). Mínimo 1 por declaração; suporta múltiplos (múltiplos 5472/linhas).
- **reportable_transactions** (ajustes):
  - `related_party_id`
  - `tx_type` (enum padronizado)
  - `amount_usd`, `amount_original`, `currency`, `fx_rate`, `fx_source`
  - `tx_date`, `description`
  - `documentation_status` (ok / pendente)

### C) Gestão de filing
- **filing_deliveries** — Uma “entrega”: `tax_filing_id`, `filing_method` (paper/mail, fax…), `shipping_tracking`, `fax_confirmation`, `sent_at`, `delivered_at`, responsável.
- **deadlines** — `tax_filing_id`, `type` (federal_1120_5472, state_annual_report), `due_date`, `is_extended`, `extended_to`, `status`.

---

## 3. Workflow de telas (interno)

1. **Intake** — Cliente + LLC. Validações: EIN, estado, data formação, endereço, US mailing address, responsável.
2. **Qualificação fiscal (wizard)** — Foreign-owned? Single-member disregarded? Teve transações com related party? Mesmo “não” → reportar aportes/distribuições/loan/fees.
3. **Related Parties** — Cadastro obrigatório de ao menos 1.
4. **Transações reportáveis (ledger)** — Importação CSV + edição manual + anexos por transação.
5. **Review & Diagnostics** — Tax Readiness Score: missing related party, totais, documentos, ano não fechado.
6. **Gerar pacote (PDF)** — Form 1120 pro forma, Form 5472, cover sheet interno.
7. **Registrar envio** — Comprovante, tracking, data/hora, responsável.

---

## 4. Geração de PDF (MVP)

- Preencher **PDF oficial do IRS** com **pdf-lib** (mapeamento de campos).
- Guardar **preview** + **final (imutável)** com hash.

---

## 5. Stack e evolução

- **Agora:** Next.js + Tailwind + Drizzle + SQLite.
- **Planejar:** migração para Postgres quando: 3+ usuários simultâneos, concorrência/locks, auditoria robusta, anexos/logs crescendo.
- **PII:** criptografia em repouso (campos sensíveis), RBAC, audit log obrigatório.

---

## 6. Ordem de implementação (checklist)

| # | Feature | Status |
|---|---------|--------|
| 1 | **RBAC + Audit Log** | ✅ (users, roles, audit_log; login por usuário; página /audit) |
| 2 | **Related Parties** + FX + anexos por transação | ✅ (CRUD related parties; FX campos no schema; seletor em transações) |
| 3 | **Painel de pendências (Readiness)** | ✅ (Tax Readiness Score, bloqueios e avisos na declaração) |
| 4 | **Gerador de PDF** (1120 pro forma + 5472) | ✅ (pacote VulpeTax) |
| 5 | **Registro de envio** + evidência (tracking/fax) | ✅ |
| 6 | **Lembretes de prazo** | 🔲 |

---

*Última atualização: conforme blueprint single-member foreign-owned disregarded entity.*
