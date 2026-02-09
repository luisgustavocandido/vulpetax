# Deploy VulpeTax no Railway

## Pré-requisitos

- Conta no [Railway](https://railway.app)
- Repositório no GitHub com o código do projeto

## Passo a passo

### 1. Criar projeto no Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **"New Project"**
3. Escolha **"Deploy from GitHub repo"** e conecte o repositório

### 2. Adicionar Volume (para persistir o SQLite)

1. No seu serviço, clique em **"+ New"** → **"Volume"**
2. Crie o volume (ex: `sqlite-data`)
3. Clique no volume e em **"Add mount"**
4. **Mount path:** `/data`
5. Vincule ao serviço da aplicação

### 3. Variáveis de ambiente

No serviço, vá em **Variables** e adicione:

| Variável        | Valor                    |
|-----------------|--------------------------|
| `DATABASE_PATH` | `/data/vulpetax.db`      |
| `NODE_ENV`      | `production`             |

(Opcional) Para login sem passar pelo seed, defina um usuário padrão:

| Variável                 | Valor           |
|--------------------------|-----------------|
| `VULPETAX_DEFAULT_USER_ID` | `[id-do-usuario]` |

### 4. Comando de início

Em **Settings** → **Deploy** → **Custom Start Command**:

```bash
npm run start:prod
```

Isso executa `db:push` (cria/atualiza tabelas) e depois inicia o servidor.

### 5. Deploy

O Railway detecta Next.js e roda `npm run build` automaticamente. Após o deploy, clique em **"Generate Domain"** para obter a URL pública.

### 6. Criar usuário (seed)

Na primeira vez, acesse:

```bash
POST https://sua-url.railway.app/seed
```

Use curl, Postman ou o navegador (com extensão REST) para chamar o endpoint. Isso cria um usuário admin e dados de exemplo.

Depois acesse `/login` e selecione o usuário.

## Resumo das configurações

- **Volume:** montado em `/data`
- **DATABASE_PATH:** `/data/vulpetax.db`
- **Start command:** `npm run start:prod`
