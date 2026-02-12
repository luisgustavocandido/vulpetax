# Vulpeinc — Sistema de Gestão de Clientes (MVP-1)

Next.js 14 + Drizzle ORM + PostgreSQL. Especificação em `docs/ESPECIFICACAO_MVP_CLIENTES.md`.


## Pré-requisitos

- Node.js 18+
- Docker (para Postgres local)

> **Deploy na Vercel:** a Vercel exige Postgres remoto (Neon, Supabase). Veja `docs/DEPLOY_VERCEL.md`.

## Rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar ambiente

```bash
cp .env.example .env
```

Edite `.env` se necessário (credenciais padrão já funcionam com o Docker).

### 3. Subir Postgres

```bash
docker compose up -d
```

> **Porta 5432 em uso?** Edite `docker-compose.yml` e mapeie para outra porta, ex: `"5433:5432"`. Ajuste `DATABASE_URL` no `.env` para `localhost:5433`. Para produção na Vercel, use Postgres remoto.

### 4. Aplicar migrações

```bash
npm run db:migrate
```

### 5. Seed (usuários iniciais)

```bash
npm run db:seed
```

Cria:
- **Admin:** `admin@vulpeinc.com` / `admin123`
- **User:** `user@vulpeinc.com` / `user123`

### 6. Rodar a aplicação

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando         | Descrição                          |
|-----------------|------------------------------------|
| `npm run dev`   | Servidor de desenvolvimento        |
| `npm run build` | Build de produção                  |
| `npm run start` | Servidor de produção               |
| `npm run db:generate` | Gerar migração Drizzle       |
| `npm run db:migrate`  | Aplicar migrações            |
| `npm run db:push`     | Push schema (dev)             |
| `npm run db:studio`   | Drizzle Studio (UI do banco)  |
| `npm run db:seed`     | Seed de usuários              |

## Estrutura

```
src/
├── app/
│   ├── api/auth/[...nextauth]/   # NextAuth route handler
│   ├── login/                    # Página e formulário de login
│   ├── clients/                  # Área protegida
│   └── providers.tsx             # SessionProvider (NextAuth)
├── db/
│   ├── index.ts   # Conexão Drizzle
│   ├── schema.ts  # Tabelas e relações
│   └── seed.ts    # Seed inicial
├── lib/
│   └── auth.ts    # authOptions, getCurrentUser(), requireRole()
└── middleware.ts  # Proteção de rotas (/clients, /api)
```

## Autenticação

- **Login:** `/login` (e-mail/senha). Após login → redireciona para `/clients`.
- **Roles:** `admin` (full), `user` (leitura + edição; sem delete/import no MVP-1).
- **Uso no server (Server Components, Route Handlers, Server Actions):**
  - `const user = await getCurrentUser()` — retorna o usuário da sessão ou `null`.
  - `const user = await requireRole(["admin"])` — exige uma das roles; retorna 401/403 se não autenticado ou sem permissão.
- **Exemplos:** `GET /api/auth/me` (usuário atual), `GET /api/example-admin` (exige role admin).
