# PDF Pós-Venda LLC

Geração do documento PDF Pós-Venda LLC a partir do template DOCX e dos dados do cliente.

**Abordagem:** Template DOCX com placeholders (`<<chave>>`) → docxtemplater preenche → conversão DOCX→PDF via HTTP (Gotenberg ou CloudConvert). **Sem LibreOffice local.**

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `PDF_CONVERTER_PROVIDER` | Não | `gotenberg` (padrão) ou `cloudconvert` |
| `GOTENBERG_URL` | Sim (se gotenberg) | URL base do Gotenberg, ex: `http://localhost:3001` ou `http://gotenberg:3000` (Docker) |
| `CLOUDCONVERT_API_KEY` | Sim (se cloudconvert) | Chave API do CloudConvert |
| `CLOUDCONVERT_SANDBOX` | Não | `true` para usar API sandbox; `false` (padrão) para produção |
| `PDF_CONVERSION_TIMEOUT_MS` | Não | Timeout em ms para conversão (padrão: 60000) |
| `PDF_CONVERSION_RETRY_COUNT` | Não | Número de retries para erros transitórios (padrão: 2) |

### Exemplo .env (Gotenberg local)

```bash
PDF_CONVERTER_PROVIDER=gotenberg
GOTENBERG_URL=http://localhost:3001
```

### Exemplo .env (timeouts e retry)

```bash
PDF_CONVERTER_PROVIDER=gotenberg
GOTENBERG_URL=http://localhost:3001
PDF_CONVERSION_TIMEOUT_MS=90000
PDF_CONVERSION_RETRY_COUNT=2
```

### Exemplo .env (Docker Compose)

```bash
PDF_CONVERTER_PROVIDER=gotenberg
GOTENBERG_URL=http://gotenberg:3000
```

### Exemplo .env (CloudConvert fallback)

```bash
PDF_CONVERTER_PROVIDER=cloudconvert
CLOUDCONVERT_API_KEY=sua-chave-api
CLOUDCONVERT_SANDBOX=false
```

## Gotenberg (Opção A – recomendada)

### Subir com Docker Compose

O projeto inclui Gotenberg no `docker-compose.yml`:

```bash
docker compose up -d gotenberg
```

Isso sobe o Gotenberg em `http://localhost:3001`. Configure:

```bash
GOTENBERG_URL=http://localhost:3001
```

### Subir manualmente (Docker)

```bash
docker run -d -p 3001:3000 gotenberg/gotenberg:8 gotenberg --api-timeout=60s
```

### Cloud Run / produção

Faça deploy da imagem `gotenberg/gotenberg:8` no Cloud Run (ou similar) e defina `GOTENBERG_URL` com a URL do serviço.

### Healthcheck (opcional, dev)

Para verificar se o Gotenberg está acessível durante o desenvolvimento:

```ts
import { pingGotenberg } from "@/lib/pdf/pingGotenberg";

const result = await pingGotenberg();
// result: { ok: boolean, ms?: number, error?: string }
```

Execute o healthcheck durante o desenvolvimento:

```bash
npm run pdf:ping-gotenberg
```

O script tenta acessar `{GOTENBERG_URL}/health`. Se a URL estiver incorreta ou o serviço indisponível, `ok` será `false`.

## CloudConvert (Opção B – fallback)

1. Crie conta em [cloudconvert.com](https://cloudconvert.com)
2. Obtenha a API key em **Dashboard > API**
3. Defina `PDF_CONVERTER_PROVIDER=cloudconvert` e `CLOUDCONVERT_API_KEY`

## Template DOCX

O template deve estar em:

```
src/assets/templates/pos-venda-llc-template.docx
```

### Placeholders normalizados (contrato)

| Placeholder | Origem |
|-------------|--------|
| `<<empresa>>` | clients.companyName |
| `<<codigo_cliente>>` | clients.customerCode |
| `<<data_pagamento>>` | clients.paymentDate (dd/MM/yyyy) |
| `<<comercial>>` | clients.commercial |
| `<<sdr>>` | clients.sdr |
| `<<tipo_negocio>>` | clients.businessType |
| `<<pagamento_via>>` | clients.paymentMethod |
| `<<flag_anonimo>>` | clients.anonymous (Sim/Não) |
| `<<flag_holding>>` | clients.holding (Sim/Não) |
| `<<flag_afiliado>>` | clients.affiliate (Sim/Não) |
| `<<flag_express>>` | clients.express (Sim/Não) |
| `<<observacao>>` | clients.notes |
| `<<item_N_tipo>>` .. `<<item_N_sdr>>` | client_line_items (N=1..5); **ordem fixa por tipo** |
| `<<socio_N_nome>>` .. `<<socio_N_pct>>` | client_partners (N=1..5) |

- **Itens 1–5 (tabela Descrição \| Valor):** ordem fixa — #1 LLC, #2 Endereço, #3 Gateway, #4 Serviço Adicional, #5 Banco Tradicional. Cada slot usa o primeiro line item do cliente com aquele `kind`; descrição formatada com rótulo (ex.: "LLC: …", "Endereço: provedor, endereço · periodicidade"). Sem item = "—" no valor.
- Campos vazios: preenchidos com `—`
- Flags: `"Sim"` / `"Não"`
- Valores: USD com 2 casas decimais
- Datas: `dd/MM/yyyy`

### Atualizar placeholders no template

Para normalizar placeholders antigos (ex.: com emojis), execute:

```bash
npm run pdf:update-template
```

### Teste de cobertura de placeholders

Garantir que o view-model cobre todos os placeholders esperados:

```bash
npm run pdf:test-placeholders
```

## Uso

### Na UI

Na tela de edição do cliente (`/clients/[id]`), clique em **"Gerar PDF Pós-Venda"**. O PDF será aberto em nova aba.

### Via API

```
GET /api/pdf/pos-venda-llc?clientId=<uuid>
```

**Resposta:** PDF (Content-Type: application/pdf)

**Headers:**
- Content-Type: application/pdf
- Content-Disposition: inline; filename="Pos-Venda-LLC-<empresa_sanitizada>.pdf"
- Cache-Control: no-store

**Erros (JSON):**
- 400: `clientId` ausente ou inválido (deve ser UUID)
- 401: Não autenticado
- 404: Cliente não encontrado
- 429: Rate limit excedido (30 PDFs / 10 min por IP)
- 500: Erro ao gerar (template ausente, Gotenberg indisponível, etc.)

Resposta de erro: `{ error, code?, details? }` — `details` apenas em desenvolvimento.

## Como testar

1. Suba o Gotenberg: `docker compose up -d gotenberg`
2. Configure `GOTENBERG_URL=http://localhost:3001` no `.env`
3. Inicie o app: `npm run dev`
4. Abra um cliente: `/clients/[id]`
5. Clique em "Gerar PDF Pós-Venda"
6. Verifique se o PDF abre com os dados preenchidos

**Via cURL:**
```bash
curl -o out.pdf "http://localhost:3000/api/pdf/pos-venda-llc?clientId=<uuid>"
```
(Envie os cookies de sessão se a rota exigir autenticação.)

## Troubleshooting

### "undefined" em campos do PDF

- **Causa:** Placeholder no template não existe no view-model.
- **Solução:**
  1. Confira o contrato em [Placeholders normalizados](#placeholders-normalizados-contrato)
  2. Execute `npm run pdf:update-template` se o template ainda usar placeholders antigos
  3. Execute `npm run pdf:test-placeholders` para validar
  4. O endpoint retorna `PLACEHOLDER_MISMATCH` se faltar alguma chave

### GOTENBERG_URL não configurado

- Defina `GOTENBERG_URL` no `.env` (ex: `http://localhost:3001`)
- Ou use CloudConvert: `PDF_CONVERTER_PROVIDER=cloudconvert` e `CLOUDCONVERT_API_KEY`

### Gotenberg retorna 503 / timeout

- Aumente o timeout: `PDF_CONVERSION_TIMEOUT_MS=90000` e `--api-timeout=120s` no container
- Verifique se o container está rodando: `docker ps`
- Em rede Docker, use `http://gotenberg:3000` em vez de localhost
- O healthcheck `/health` pode ser usado para validar conectividade

### CloudConvert job falhou

- Confirme a API key em [CloudConvert Dashboard](https://cloudconvert.com/dashboard/api/v2/keys)
- Use `CLOUDCONVERT_SANDBOX=true` para testes
- Verifique limites da conta
