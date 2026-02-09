# Formulário VulpeTax (PT-BR) — Mapeamento

Formulário em uso: **Formulario_VulpeTax_PTBR.pdf**  
Objetivo: coleta de dados fiscais para LLC de não residentes (Form 5472 + pro forma 1120).

**Status:** Schema e fluxo do VulpeTax foram alinhados a este formulário (campos de cliente, LLC, declaração, resumo por tipo e declaração final).

---

## 1. DADOS DA LLC

| Campo no formulário | Campo no VulpeTax (schema) | Observação |
|--------------------|----------------------------|------------|
| Nome da LLC * | `llcs.name` | ✅ |
| Data de formação (DD/MM/AAAA) * | `llcs.formationDate` | ✅ |
| Atividades exercidas pela empresa * | `llcs.businessActivity` | ✅ |
| Número EIN * | `llcs.ein` | ✅ |
| Endereço: Endereço, Linha 2, Cidade, Estado, Código Postal * | `llcs.addressLine1`, `addressLine2`, `city`, `stateAddress`, `zip` | ✅ |

---

## 2. DADOS DO PROPRIETÁRIO (PRINCIPAL)

| Campo no formulário | Campo no VulpeTax (schema) | Observação |
|---------------------|----------------------------|------------|
| E-mail * | `clients.email` | ✅ |
| Nome legal completo * | `clients.fullName` | ✅ |
| País de residência * | `clients.country` | ✅ |
| País de cidadania * | `clients.citizenshipCountry` | ✅ |
| Endereço particular diferente do endereço da empresa? (NÃO/SIM) * | `clients.addressDifferentFromLLC` | ✅ |
| Identificação fiscal dos EUA, se aplicável | `clients.usTin` | ✅ |
| Custo de constituição da LLC (USD) * | `llcs.formationCostUsd` | ✅ |
| Identificação fiscal pessoal estrangeira | `clients.foreignTin`, `idType`, `idNumber` | ✅ |
| Há outro sócio para adicionar? (NÃO/SIM) * | — | No nosso modelo: single-member; múltiplos “related parties” por declaração cobrem sócio/empresa do sócio. Formulário pergunta até 5 sócios. |

---

## 3. SÓCIOS ADICIONAIS (2 a 5)

Formulário: mesmos dados do proprietário principal.  
VulpeTax: **related_parties** por declaração (nome, tipo, país, endereço, TIN). Para multi-member seria outro fluxo; hoje o produto é focado em single-member. Podemos ter até N related parties por filing.

---

## 4. SOBRE OS ATIVOS DA EMPRESA

| Campo no formulário | Campo no VulpeTax (schema) | Observação |
|--------------------|----------------------------|------------|
| Ativos totais até 31/12 (USD) * | `tax_filings.totalAssetsYearEndUsd` | ✅ |
| Possui contas bancárias nos EUA em nome da LLC? (NÃO/SIM) * | `tax_filings.hasUsBankAccounts` | ✅ |
| Saldo agregado > USD 10.000 no ano? (NÃO/SIM) — FBAR | `tax_filings.aggregateBalanceOver10k` | ✅ (FBAR custo USD 100 indicado na UI) |

---

## 5. TOTAIS (REPORTABLE TRANSACTIONS / 5472)

| Campo no formulário | No VulpeTax | Observação |
|--------------------|-------------|------------|
| Total de retiradas no ano fiscal (USD) | Soma de transações tipo `distribution` | ✅ Ledger; podemos expor “total distribuições” |
| Total transferido pessoalmente para a LLC (USD) | Soma de `contribution` + eventualmente `loan_from_owner` | ✅ |
| Total retirado pessoalmente da LLC (USD) | Soma de `distribution` + `loan_to_owner` | ✅ |
| Despesas pessoais pagas com recursos da empresa (USD) | Tipo `personal_expenses_paid_by_llc` | ✅ |
| Despesas empresariais pagas com recursos pessoais (USD) | Tipo `business_expenses_paid_personally` | ✅ |

Na tela da declaração: **resumo por tipo** (totais alinhados ao form) + ledger de transações.

---

## 6. ENVIO DE ARQUIVOS

| Campo no formulário | No VulpeTax | Observação |
|--------------------|-------------|------------|
| Cópia dos passaportes dos sócios * | `attachments` (entity_type: client ou related_party) | ✅ Schema existe; falta UI de upload |
| Articles of Organization * | `attachments` (entity_type: llc) | ✅ |
| EIN emitido pelo IRS | `attachments` (entity_type: llc) | ✅ |
| Documentos adicionais? (NÃO/SIM) | — | Flag + anexos opcionais |

---

## 7. DECLARAÇÃO FINAL

Checkbox: “Declaro que li e compreendi…”  
`tax_filings.declarationAcceptedAt` + `declarationAcceptedBy` (user_id). Bloco “Declaração final” na página da declaração com botão “Aceitar declaração”. ✅

---

## Implementado no VulpeTax

- Cliente: `citizenshipCountry`, `addressDifferentFromLLC`, `usTin`; formulário com todos os campos.
- LLC: `formationCostUsd`; formulário com custo de constituição.
- Tax filing: `totalAssetsYearEndUsd`, `hasUsBankAccounts`, `aggregateBalanceOver10k`, `declarationAcceptedAt` / `declarationAcceptedBy`; bloco “Dados do ano” + “Declaração final”.
- Transações: tipos `personal_expenses_paid_by_llc` e `business_expenses_paid_personally`; resumo por tipo na declaração.
- **Pendente:** upload de anexos (attachments) no fluxo.

Quando o gerador de PDF for implementado, este documento serve de referência para preencher o **Formulario_VulpeTax_PTBR.pdf** a partir dos dados do VulpeTax.
