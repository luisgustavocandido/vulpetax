# Notas de Implementação — UI MVP-1

## Estrutura de arquivos

```
src/
├── app/clients/
│   ├── layout.tsx          # Header + Sair (já existia)
│   ├── page.tsx            # Listagem (Server)
│   ├── loading.tsx         # Loading state
│   ├── new/
│   │   └── page.tsx        # Criar cliente
│   └── [id]/
│       ├── page.tsx        # Editar cliente (Server + Client children)
│       ├── not-found.tsx   # 404
│       └── ClientDeleteButton.tsx  # Client: confirmação + DELETE
├── components/
│   ├── ClientForm.tsx      # Client: form + Zod + fetch
│   ├── ClientTable.tsx     # Server: tabela estática
│   ├── ClientsFilters.tsx  # Server: form GET (busca + status)
│   └── Pagination.tsx      # Client: links Anterior/Próximo
└── lib/
    └── api.ts              # getBaseUrl() para Server Components
```

## Server vs Client

| Componente | Tipo | Motivo |
|------------|------|--------|
| `clients/page.tsx` | Server | Fetch da API no servidor, sem estado |
| `clients/new/page.tsx` | Server (wrapper) | Apenas layout; form é client |
| `clients/[id]/page.tsx` | Server | Fetch de dados; form e delete são client |
| `ClientForm` | Client | Validação Zod, submit fetch, estado de erro |
| `ClientTable` | Server | Tabela estática, dados via props |
| `ClientsFilters` | Server | Form `method="GET"` — submit = navegação, sem JS |
| `Pagination` | Client | Links dinâmicos com querystring |
| `ClientDeleteButton` | Client | Confirmação, fetch DELETE, redirect |

## API

- **GET /api/clients** — aceita `page`, `limit`, `q`, `status`
- **POST /api/clients** — 400 (validação), 409 (CPF/CNPJ duplicado), 201
- **GET /api/clients/[id]** — 404 se não existir ou deletado
- **PATCH /api/clients/[id]** — 400 (validação), 404
- **DELETE /api/clients/[id]** — 204 (soft delete)

## Tratamento de erro

- Respostas com `{ error, details }`: `details` pode ser `fieldErrors` (Zod) ou `{ cpfCnpj: ["msg"] }` (409)
- ClientForm normaliza ambos e exibe erros por campo
- Listagem: exibe mensagem genérica se fetch falhar

## Base URL

- `getBaseUrl()` usa `VERCEL_URL` (prod) ou `localhost:3000` (dev)
- Definir `HOST` no `.env` se usar outra porta
