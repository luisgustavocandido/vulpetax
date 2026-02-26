# Passo a passo: levar o projeto para outro PC

Use este guia para clonar o projeto (branch V2) no outro computador e deixar tudo funcionando.

---

## No PC atual (antes de sair)

### 1. Fazer backup do banco de dados (recomendado)

Assim você leva os dados para o outro PC.

```bash
cd /caminho/do/eafc   # ou vulpetax, onde está o projeto
chmod +x scripts/backup-database.sh
./scripts/backup-database.sh
```

Isso gera um arquivo em `backups/backup_AAAAAMMDD_HHMMSS.sql`.

- **Copie esse arquivo** para um pendrive ou nuvem (a pasta `backups/` não vai no Git).

### 2. Garantir que está tudo no GitHub (branch V2)

```bash
git status
git push origin V2   # se tiver algo pendente
```

### 3. Anotar o que não está no repositório

- **Arquivo `.env`** – não está no Git (segurança). No outro PC você vai criar um novo a partir de `.env.example` e preencher (ou copiar o `.env` atual por outro meio, ex.: pendrive).
- **Backup do banco** – se fez o passo 1, leve o `.sql` por pendrive/nuvem.
- **Chaves/credenciais** – se usar Google Sheets, Gotenberg, etc., leve as chaves/IDs por meio seguro.

---

## No outro PC

### 1. Instalar o que for preciso

- **Node.js** 18+ (recomendado LTS): https://nodejs.org/
- **PostgreSQL** (se for rodar o banco nesse PC): https://www.postgresql.org/download/
- **Git**: https://git-scm.com/

### 2. Clonar o repositório e usar a branch V2

```bash
git clone https://github.com/luisgustavocandido/vulpetax.git
cd vulpetax
git checkout V2
```

### 3. Dependências do projeto

```bash
npm install
```

### 4. Configurar o ambiente (.env)

```bash
cp .env.example .env
```

Abra o `.env` e preencha:

- **DATABASE_URL** – conexão do PostgreSQL no outro PC (ou servidor). Ex.:  
  `postgresql://usuario:senha@localhost:5432/vulpeinc_clients`
- **NEXTAUTH_SECRET** – gere um novo: `openssl rand -base64 32`
- **PASSCODE** – a senha do login por passcode.
- **NEXTAUTH_URL** – ex.: `http://localhost:3000` em desenvolvimento.

Se você copiou o `.env` do PC antigo (por pendrive, etc.), pode colar o conteúdo no `.env` desse PC e só ajustar o que mudar (por exemplo o host do banco).

### 5. Banco de dados

**Opção A – Você trouxe o backup (.sql)**

Crie o banco (se ainda não existir) e restaure:

```bash
# Criar o banco (no psql ou pgAdmin), depois:
chmod +x scripts/restore-database.sh
./scripts/restore-database.sh backups/backup_AAAAAMMDD_HHMMSS.sql
```

(Coloque o arquivo de backup em `backups/` ou use o caminho correto no comando.)

**Opção B – Banco novo (sem restaurar backup)**

Só criar o banco e rodar as migrações:

```bash
npm run db:migrate
```

Isso aplica as migrações em `drizzle/` e deixa o schema igual ao do projeto (sem dados do PC antigo).

### 6. Rodar o projeto

```bash
npm run dev
```

Abrir no navegador: **http://localhost:3000**

---

## Resumo rápido (só o outro PC)

```bash
git clone https://github.com/luisgustavocandido/vulpetax.git
cd vulpetax
git checkout V2
npm install
cp .env.example .env
# Editar .env com DATABASE_URL, NEXTAUTH_SECRET, etc.
npm run db:migrate
# Se tiver backup: ./scripts/restore-database.sh backups/backup_xxx.sql
npm run dev
```

---

## Checklist

- [ ] Backup do banco feito no PC antigo e arquivo `.sql` levado para o outro PC (ou não precisa de dados)
- [ ] Repositório no GitHub com a branch V2 atualizada
- [ ] No outro PC: Node, PostgreSQL (se local) e Git instalados
- [ ] Clone do repo + `git checkout V2`
- [ ] `npm install`
- [ ] `.env` criado e preenchido (ou copiado)
- [ ] `npm run db:migrate` (e restore do backup, se for o caso)
- [ ] `npm run dev` e teste em http://localhost:3000

Se algo falhar, confira: nome do banco e usuário/senha no `DATABASE_URL`, porta do Postgres e se o serviço está rodando.
