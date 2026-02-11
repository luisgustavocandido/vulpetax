# Especificação Técnica — Sistema de Gestão de Clientes Vulpeinc

## 1. Checklist de Requisitos

### 1.1 Funcionais

| # | Requisito | Base (Pergunta) | Obrigatório | Opcional | Pendência |
|---|-----------|-----------------|-------------|----------|-----------|
| F1 | CRUD de clientes (create, read, update, delete) | P3, P8 | ✓ | | |
| F2 | Importação CSV/XLSX com mapeamento de colunas | P1, P7 | ✓ | | |
| F3 | Validação de CPF/CNPJ e unicidade | P3 | ✓ | | |
| F4 | Validação de e-mail (formato e obrigatoriedade conforme regra) | P3 | ✓ | | |
| F5 | Campo "status" do cliente (ativo/inativo) | P3 | ✓ | | |
| F6 | Filtros e busca de clientes | P6, P8 | ✓ | | |
| F7 | Deduplicação na importação | P3, P8 | ✓ | | |
| F8 | Listagem paginada de clientes | P2 | ✓ | | |
| F9 | Login e autenticação de usuários | P5 | ✓ | | |
| F10 | Permissões: admin (full) vs usuário (leitura/edição limitada) | P5 | ✓ | | |
| F11 | Auditoria de alterações em clientes | P4 | ✓ | | |
| F12 | Auditoria de ações de usuários (quem fez o quê) | P4, P5 | ✓ | | |
| F13 | Exportação de clientes (CSV) | P6 | | ✓ | |
| F14 | Relatórios/dashboards por segmento ou período | P6 | | ✓ | Pendência: definir métricas |
| F15 | Integração CRM/e-mail/WhatsApp | P6 | | ✓ | Pendência: validar necessidade |
| F16 | Soft delete (exclusão lógica) com registro de exclusão | P4 | ✓ | | |
| F17 | Tela de configuração de mapeamento de colunas para importação | P1 | ✓ | | Pendência: ver estrutura real do CSV |

### 1.2 Não-funcionais

| # | Requisito | Base (Pergunta) | Obrigatório | Opcional | Pendência |
|---|-----------|-----------------|-------------|----------|-----------|
| NF1 | PostgreSQL como banco de dados | - | ✓ | | |
| NF2 | Performance: busca em &lt; 2s para até ~10k registros | P2, P8 | ✓ | | Pendência: confirmar volume |
| NF3 | Armazenamento seguro (HTTPS, secrets em env) | P4 | ✓ | | |
| NF4 | LGPD: consentimento e base legal documentados | P4 | ✓ | | Pendência: validar com jurídico |
| NF5 | Anonimização ou exclusão programada sob demanda | P4 | | ✓ | Pendência: definir política |
| NF6 | Deploy em ambiente estável (Railway, Render, Vercel+DB) | - | ✓ | | |
| NF7 | Backup automático do banco | P4 | ✓ | | |

---

## 2. Opções de Escopo MVP

### MVP-1 (Mínimo — ~2–3 semanas)

| Área | Escopo |
|-----|--------|
| **Telas** | Login, Listagem de clientes (busca + filtro), Formulário de cliente (criar/editar), Tela de importação CSV/XLSX com upload e preview |
| **Permissões** | Admin: CRUD completo + importação. Usuário: leitura + edição (sem deletar, sem importar) |
| **Importação** | Upload CSV/XLSX, mapeamento fixo (colunas predefinidas), validação básica, deduplicação por CPF/CNPJ, upsert |
| **Auditoria** | Tabela `audit_log` com: quem, quando, ação (create/update/delete), entidade, ID, diff (JSON) — sem UI, só dados |

### MVP-2 (Completo — ~4–6 semanas)

| Área | Escopo |
|-----|--------|
| **Telas** | Todas do MVP-1 + Dashboard (contagem por status, últimos cadastros), Relatório exportável (CSV), Tela de auditoria (listagem de alterações filtrada) |
| **Permissões** | Admin, Usuário (leitura+edição), Leitor (somente leitura) |
| **Importação** | Tudo do MVP-1 + mapeamento configurável (salvar perfis), validação avançada com relatório de erros por linha, histórico de importações |
| **Auditoria** | Tabela `audit_log` + UI para consultar alterações por cliente e por usuário, filtros por período |

**Trade-off:** MVP-1 entrega valor rápido e permite validar uso. MVP-2 adiciona visibilidade e governança. Recomendação: começar com MVP-1 e iterar.

---

## 3. Modelo de Dados (PostgreSQL)

### 3.1 Diagrama lógico

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ users       │     │ clients      │     │ audit_log   │
├─────────────┤     ├──────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)      │     │ id (PK)     │
│ email       │     │ name         │     │ user_id FK  │
│ password    │     │ email        │     │ action      │
│ role        │     │ cpf_cnpj     │     │ entity      │
│ created_at  │     │ phone        │     │ entity_id   │
│ updated_at  │     │ status       │     │ old_values  │
└─────────────┘     │ notes        │     │ new_values  │
                    │ created_at   │     │ created_at  │
                    │ updated_at   │     └─────────────┘
                    │ created_by   │
                    │ updated_by   │
                    └──────────────┘

┌─────────────────────┐
│ import_history      │
├─────────────────────┤
│ id (PK)             │
│ user_id (FK)        │
│ filename            │
│ rows_total          │
│ rows_imported       │
│ rows_errors         │
│ errors_json         │
│ created_at          │
└─────────────────────┘
```

### 3.2 DDL

```sql
-- Extensão para UUID (opcional, ou usar SERIAL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuários (auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cpf_cnpj VARCHAR(18) NOT NULL,
  phone VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,  -- soft delete
  CONSTRAINT clients_cpf_cnpj_unique UNIQUE (cpf_cnpj)
);

-- Índices para performance
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_cpf_cnpj ON clients(cpf_cnpj);
CREATE INDEX idx_clients_deleted_at ON clients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_name_trgm ON clients USING gin(name gin_trgm_ops);  -- se tiver extensão pg_trgm para busca parcial

-- Alternativa sem pg_trgm (mais simples):
CREATE INDEX idx_clients_name ON clients(LOWER(name));

-- Auditoria
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(10) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Histórico de importações
CREATE TABLE import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  rows_total INT NOT NULL,
  rows_imported INT NOT NULL DEFAULT 0,
  rows_errors INT NOT NULL DEFAULT 0,
  errors_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_user ON import_history(user_id);
CREATE INDEX idx_import_created ON import_history(created_at);
```

**Nota:** Se não usar `pg_trgm`, remova o índice `idx_clients_name_trgm` e use apenas `idx_clients_name`.

### 3.3 Estratégia de diff para auditoria

- **create:** `old_values = null`, `new_values = { todos os campos }`
- **update:** `old_values = { campos alterados }`, `new_values = { campos alterados }`
- **delete (soft):** `old_values = { registro completo }`, `new_values = null` + `deleted_at` no client

---

## 4. Fluxo de Importação CSV/XLSX

### 4.1 Mapeamento de colunas

| Coluna esperada no CSV | Campo na tabela | Obrigatório | Validação |
|------------------------|-----------------|-------------|-----------|
| Nome, nome, NOME | name | Sim | Não vazio, trim |
| E-mail, email, Email | email | Sim | Formato válido |
| CPF/CNPJ, cpf, CNPJ | cpf_cnpj | Sim | 11 ou 14 dígitos, sem máscara ou normalizado |
| Telefone, phone, celular | phone | Não | Opcional |
| Status, situacao | status | Não | "ativo" ou "inativo", default "ativo" |
| Observações, notes, obs | notes | Não | Texto livre |

**Default de mapeamento:** Se o CSV tiver cabeçalhos, fazer match case-insensitive e aceitar variações comuns. MVP-1: mapeamento fixo; MVP-2: configurável.

### 4.2 Validações

1. **Por linha:** nome, email, cpf_cnpj obrigatórios; email formato válido; cpf_cnpj tamanho e dígitos.
2. **Batch:** após parse, rodar todas as validações e coletar erros por número de linha.
3. **Saída:** array de erros `{ row: 3, field: "email", message: "Formato inválido" }`.

### 4.3 Deduplicação

- **Chave de unicidade:** `cpf_cnpj` (sem máscara, só números).
- Regra: dois registros com mesmo CPF/CNPJ → considerar duplicata. Na importação, o que vier depois (ou o que estiver no arquivo) sobrescreve (upsert).

### 4.4 Estratégia de upsert

```text
ON CONFLICT (cpf_cnpj) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = now(),
  updated_by = :user_id
```

- **Conflito:** se já existir cliente com mesmo `cpf_cnpj`, atualiza. Não insere duplicata.
- **Linhas com erro:** não inserir; registrar em `errors_json` e em `rows_errors`.
- **Transação:** processar em batch (ex: 100 linhas por commit) para não travar em arquivos grandes.

**Trade-off:** Usar `cpf_cnpj` como chave natural é adequado para Brasil. Se no futuro houver cliente sem CPF/CNPJ, precisará de chave alternativa (ex: email ou id externo). Recomendação para MVP: manter `cpf_cnpj` obrigatório e único.

---

## 5. Backlog (priorizado)

| # | Item | Prioridade | Critério de aceite |
|---|------|------------|--------------------|
| 1 | Setup projeto (Next.js, Postgres, Docker) | P0 | Repo sobe com `docker-compose up`, migrações aplicam |
| 2 | Tabelas: users, clients, audit_log, import_history | P0 | DDL executada, constraints ok |
| 3 | Auth: login com email/senha, sessão | P0 | Usuário loga e vê listagem só se autenticado |
| 4 | CRUD de clientes (API + UI) | P0 | Criar, editar, listar, soft delete |
| 5 | Listagem paginada + busca por nome/email/cpf | P0 | Busca em &lt; 2s para 10k registros |
| 6 | Importação CSV: upload, parse, validação | P0 | Upload, parse correto, erros por linha retornados |
| 7 | Importação: upsert por CPF/CNPJ, deduplicação | P0 | Sem duplicatas, conflitos viram update |
| 8 | Auditoria: registrar create/update/delete em audit_log | P1 | Cada alteração em clientes gera registro |
| 9 | Permissões: admin vs user (restringir delete e import) | P1 | User não deleta nem importa |
| 10 | Tela de importação com preview e relatório de erros | P1 | Usuário vê preview antes de confirmar e erros após import |
| 11 | Normalização de CPF/CNPJ na importação | P1 | Remove pontuação, valida dígitos |
| 12 | Exportação CSV de clientes | P2 | Botão exportar, download CSV |
| 13 | Dashboard: contagem por status, últimos cadastros | P2 | Métricas básicas visíveis |
| 14 | Tela de auditoria (listar alterações) | P2 | Filtros por cliente, usuário, período |
| 15 | Perfil "viewer" (somente leitura) | P2 | Viewer só lista e visualiza |
| 16 | Mapeamento configurável de colunas na importação | P2 | Salvar e reusar perfis de mapeamento |
| 17 | Histórico de importações (listagem) | P2 | Ver imports anteriores, totais e erros |

---

## 6. Decisões abertas e defaults

| Decisão | Depende de | Default sugerido |
|---------|------------|------------------|
| Colunas exatas do CSV | Resposta P1 | Nome, Email, CPF/CNPJ, Telefone, Status, Observações |
| Campos extras (segmento, categoria) | P1, P6 | Não incluir no MVP; adicionar se necessário |
| Volume exato (10k vs 50k) | P2 | Otimizar para 10k; paginação e índices suficientes para escalar |
| E-mail obrigatório ou opcional | P3 | Obrigatório; validar formato |
| Política de exclusão (LGPD) | P4 | Soft delete + campo `deleted_at`; exclusão definitiva manual via admin |
| Quantidade de usuários iniciais | P5 | 2 perfis: 1 admin, 1 user |
| Integrações (CRM, etc.) | P6 | Não incluir no MVP; API REST preparada para futuro |
| Frequência de importação | P7 | Suportar importação manual sob demanda; agendamento como evolução |
| Métricas do dashboard | P8 | Contagem ativo/inativo, últimos 10 cadastros |

---

## 7. Stack e estrutura do repositório

### 7.1 Stack recomendada

| Camada | Tecnologia | Motivo |
|--------|------------|--------|
| Frontend | Next.js 14 (App Router) + React + Tailwind | SSR, API routes, deploy simples |
| Backend | Next.js API Routes ou Route Handlers | Monorepo, menos infra |
| Banco | PostgreSQL 15+ | Relacional, JSONB para audit |
| ORM | Drizzle | Type-safe, migrations, leve |
| Auth | NextAuth.js ou Auth.js | Sessão, providers, middleware |
| Validação | Zod | Schemas + parse de CSV/forms |
| Import CSV/XLSX | csv-parse + xlsx (SheetJS) | Pragmático, amplamente usado |

**Trade-off:** Next.js full-stack vs separar front (React) e back (Node/Express). Recomendação: Next.js full-stack para MVP, menos deploy e menos código.

### 7.2 Estrutura sugerida

```text
eafc/
├── docker-compose.yml
├── package.json
├── .env.example
├── drizzle.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/
│   │   ├── clients/
│   │   │   ├── page.tsx          # listagem
│   │   │   ├── new/
│   │   │   ├── [id]/
│   │   │   └── import/
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── clients/
│   │       └── import/
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.ts
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── audit.ts
│   │   ├── import-csv.ts
│   │   └── validators.ts
│   └── components/
├── drizzle/
│   └── migrations/
└── docs/
```

### 7.3 docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vulpeinc
      POSTGRES_PASSWORD: vulpeinc_dev
      POSTGRES_DB: vulpeinc_clients
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://vulpeinc:vulpeinc_dev@postgres:5432/vulpeinc_clients
      NEXTAUTH_SECRET: change-me-in-production
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - postgres
    volumes:
      - .:/app
      - /app/node_modules  # evita sobrescrever node_modules no bind mount

volumes:
  postgres_data:
```

**Alternativa para dev:** Rodar apenas Postgres no Docker e a app local (`npm run dev`). Útil para hot reload.

```yaml
# docker-compose.dev.yml - só Postgres
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vulpeinc
      POSTGRES_PASSWORD: vulpeinc_dev
      POSTGRES_DB: vulpeinc_clients
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
```

---

## Resumo executivo

- **MVP-1:** Login, CRUD clientes, importação CSV com upsert, auditoria em tabela, permissões admin/user. ~2–3 semanas.
- **MVP-2:** + Dashboard, exportação, tela de auditoria, perfil viewer, mapeamento configurável. ~4–6 semanas.
- **Chave de negócio:** CPF/CNPJ único; upsert na importação; soft delete; audit_log com diff.
- **Stack:** Next.js + Drizzle + PostgreSQL + Auth.js. Docker para Postgres local.
