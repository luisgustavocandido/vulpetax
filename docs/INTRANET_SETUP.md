# VulpeTax — Servidor interno (intranet) — macOS 24/7

Este guia descreve como rodar o VulpeTax **100% localmente** como sistema interno da empresa na LAN do escritório: Next.js em produção, PostgreSQL no Docker, PM2 para 24/7, backup diário e acesso via **vulpetax.local**.

**Ambiente alvo:** macOS, notebook ligado 24/7, sem acesso ao roteador (sem DHCP reservation), banco local, stack Next.js 14 + Drizzle + PostgreSQL.

---

## 1. Infraestrutura do banco (Docker)

### 1.1 docker-compose.yml

O projeto inclui um `docker-compose.yml` com:

- **PostgreSQL 16** (imagem Alpine)
- **Volume persistente** nomeado (`postgres_data`)
- **restart: always**
- Variáveis de ambiente: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Porta **5432** exposta no host
- Container nomeado: `vulpetax-postgres` (para backup e recuperação)
- **healthcheck** opcional: `pg_isready` para marcar o container como healthy (usa `user`/`vulpetax`; se alterar `POSTGRES_USER`/`POSTGRES_DB`, ajuste o healthcheck no `docker-compose.yml`)

Valores padrão no compose (podem ser sobrescritos por variáveis de ambiente):

- `POSTGRES_USER`: user  
- `POSTGRES_PASSWORD`: password  
- `POSTGRES_DB`: vulpetax  

### 1.2 Subir o banco

Na raiz do projeto:

```bash
docker compose up -d
```

### 1.3 Verificar o container

```bash
docker ps
```

Deve aparecer algo como:

```
CONTAINER ID   IMAGE                STATUS         PORTS                    NAMES
xxxx           postgres:16-alpine   Up 2 minutes   0.0.0.0:5432->5432/tcp   vulpetax-postgres
```

### 1.4 Acessar o psql

```bash
docker exec -it vulpetax-postgres psql -U user vulpetax
```

Substitua `user` e `vulpetax` se tiver alterado `POSTGRES_USER` ou `POSTGRES_DB`. Para sair: `\q`.

---

## 2. Configuração DATABASE_URL e migrações

### 2.1 .env

Copie o exemplo e ajuste (user/senha devem ser os mesmos do `docker-compose`):

```bash
cp .env.example .env
```

Exemplo no `.env` (alinhado aos padrões do compose):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/vulpetax
```

Se tiver usado outros valores em `POSTGRES_USER`, `POSTGRES_PASSWORD` ou `POSTGRES_DB`, use-os na URL.

### 2.2 Aplicar migrações

```bash
npm install
npm run db:migrate
```

Execute isso após o primeiro `docker compose up -d` e sempre que houver novas migrações no projeto.

---

## 3. Scripts npm (produção LAN)

**Não use o servidor de desenvolvimento** em produção. Use apenas build + start.

| Script | Uso |
|--------|-----|
| `npm run build` | Gera o build de produção. |
| `npm run start:lan` | Sobe o Next em **0.0.0.0:3000** (acessível na LAN). Requer `build` antes. |
| `npm run prod:lan` | Faz `npm run build` e em seguida `npm run start:lan`. |

Uso direto (sem PM2):

```bash
npm run prod:lan
```

O app fica em **http://localhost:3000** neste Mac e em **http://<IP-DO-MAC>:3000** nos outros PCs da LAN.

---

## 4. PM2 (execução 24/7)

O arquivo **ecosystem.config.js** na raiz já está configurado para o VulpeTax.

### 4.1 Instalar PM2 (global)

```bash
npm i -g pm2
```

### 4.2 Build e início com PM2

Na pasta do projeto:

```bash
npm run build
pm2 start ecosystem.config.js
```

### 4.3 Comandos úteis

```bash
pm2 list              # listar processos
pm2 logs vulpetax     # logs em tempo real
pm2 restart vulpetax
pm2 stop vulpetax
pm2 delete vulpetax
```

### 4.4 Iniciar PM2 no boot (recomendado para 24/7)

```bash
pm2 startup
# Executar o comando que o PM2 mostrar (ex.: sudo env PATH=... pm2 startup launchd)
pm2 save
```

Assim, após reiniciar o notebook, o VulpeTax sobe automaticamente.

**Opcional — rotação de logs (pm2-logrotate):** para limitar tamanho dos logs do PM2:

```bash
npm i -g pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

---

## 5. Backup automático diário

### 5.1 Script backup.sh

O projeto inclui **backup.sh** na raiz. Ele usa `docker exec` + `pg_dump` e grava em **./backups** com data no nome.

Dar permissão de execução:

```bash
chmod +x backup.sh
```

Executar manualmente:

```bash
./backup.sh
```

Os arquivos ficam em `./backups/vulpetax_YYYY-MM-DD_HHMMSS.sql`. O diretório `backups/` está no `.gitignore`.

**Retenção opcional:** para manter só os últimos N dias (ex.: 30), execute o backup com `KEEP_DAYS=30`:

```bash
KEEP_DAYS=30 ./backup.sh
```

No crontab, use `KEEP_DAYS=30` no mesmo ambiente (ex.: script wrapper ou variável no cron).

Se o container ou usuário/banco forem outros, use variáveis de ambiente (ou ajuste no script):

```bash
PG_CONTAINER=vulpetax-postgres POSTGRES_USER=user POSTGRES_DB=vulpetax ./backup.sh
```

### 5.2 Agendar backup diário (crontab)

Abrir crontab:

```bash
crontab -e
```

Adicionar (backup todo dia às 2h; ajuste o caminho para a pasta do projeto):

```cron
0 2 * * * /caminho/do/projeto/backup.sh
```

Exemplo se o projeto estiver em `/Users/empresa/vulpetax`:

```cron
0 2 * * * /Users/empresa/vulpetax/backup.sh
```

### 5.3 Backup externo

Recomendação: copiar a pasta **backups/** periodicamente para um serviço externo (Google Drive, OneDrive, NAS, etc.) ou outro disco, para não depender só do notebook.

---

## 6. Acesso via mDNS (vulpetax.local) — sem roteador

Como não há acesso ao roteador para reserva DHCP ou DNS, use **mDNS** no macOS para que a equipe acesse por nome.

No **notebook que roda o VulpeTax**, execute (uma vez; pode pedir senha de administrador):

```bash
sudo scutil --set LocalHostName vulpetax
sudo scutil --set HostName vulpetax
sudo scutil --set ComputerName "VulpeTax"
```

Reinicie o Mac ou a rede para o nome propagar na LAN.

**Acesso pela equipe:**

- **http://vulpetax.local:3000**

Funciona em outros Macs e em muitos dispositivos que suportam mDNS (.local). Se não resolver, use o IP do notebook (ex.: `http://192.168.1.50:3000`).

---

## 7. Segurança obrigatória (intranet)

- [ ] **PASSCODE forte**  
  No `.env`, use um passcode longo e aleatório, por exemplo:  
  `openssl rand -base64 24`  
  Não use senhas óbvias.

- [ ] **Não permitir DISABLE_AUTH em produção**  
  Em produção, **não** defina `DISABLE_AUTH=true`. Mantenha sempre o login por passcode. O bypass de auth é apenas para desenvolvimento.

- [ ] **Bloquear /api/debug fora de development**  
  As rotas `/api/debug/*` retornam **403 Forbidden** em produção (`NODE_ENV=production`). Não exponha debug na intranet.

- [ ] **.env no .gitignore**  
  O `.env` está no `.gitignore`. Nunca commitar credenciais ou PASSCODE.

- [ ] **Firewall macOS**  
  Em **Preferências do Sistema → Segurança e Privacidade → Firewall**: permitir conexões apenas na **rede privada** (LAN) para o Node/Next.js, se possível. Evite expor as portas 3000 (e 80, se usar proxy) para a internet.

---

## 8. Checklist operacional diário

- [ ] **PM2**  
  `pm2 status` — processo `vulpetax` deve estar **online**.

- [ ] **Docker**  
  `docker ps` — container `vulpetax-postgres` deve estar **Up**.

- [ ] **Logs**  
  `pm2 logs vulpetax` — verificar erros recentes.

- [ ] **Espaço em disco**  
  Verificar espaço livre no disco (backups e volume do Postgres). Ex.: `df -h` e tamanho da pasta `backups/`.

- [ ] **Testar backup e restore**  
  Periodicamente: rodar `./backup.sh`, depois testar a restauração em um banco de teste (ou em outro container) com o comando da seção 9.1.

---

## 9. Plano de recuperação de desastre

### 9.1 Restaurar um backup

Com o container **vulpetax-postgres** rodando e o arquivo de backup (ex.: `backups/vulpetax_2026-02-12_020000.sql`):

```bash
docker exec -i vulpetax-postgres psql -U user vulpetax < backups/vulpetax_2026-02-12_020000.sql
```

Ajuste `user` e `vulpetax` se tiver usado outros valores. Em caso de banco já existente, pode ser necessário dropar/recrear o banco antes (ou restaurar em um banco vazio).

### 9.2 Se o notebook falhar

1. Em outro Mac (ou o mesmo após troca de hardware): clonar o repositório do projeto.
2. Instalar Node.js 18+, Docker e PM2.
3. Configurar `.env` (e, se necessário, variáveis do `docker-compose`).
4. Subir o banco: `docker compose up -d`.
5. Restaurar o último backup (ver acima).
6. `npm run build` e `pm2 start ecosystem.config.js` (ou `pm2 start ecosystem.config.js` se já tiver feito build).
7. Configurar mDNS de novo nessa máquina, se quiser manter **vulpetax.local**.

### 9.3 Migrar para outra máquina rapidamente

1. Copiar projeto + pasta **backups/** (e último `.env` seguro).
2. Na nova máquina: Docker + Node + PM2 instalados.
3. `docker compose up -d` → `npm run db:migrate` (ou restaurar backup).
4. `npm run build` → `pm2 start ecosystem.config.js` → `pm2 save` → `pm2 startup`.
5. Ajustar mDNS/hostname na nova máquina e comunicar o novo endereço (vulpetax.local ou IP) à equipe.

### 9.4 Como reinstalar rapidamente (mesma máquina)

1. Parar serviços: `pm2 delete vulpetax` (se existir), `docker compose down` (opcional; manter volume se quiser preservar dados).
2. Reinstalar dependências: `npm install`.
3. Subir banco: `docker compose up -d`.
4. Aplicar migrações (ou restaurar backup): `npm run db:migrate` ou comando de restore da seção 9.1.
5. Build e PM2: `npm run build` → `pm2 start ecosystem.config.js` → `pm2 save`.

---

## 10. Runbook e Go Live

- **Comandos do dia a dia:** ver **docs/RUNBOOK_INTRANET.md** (start/stop, rotina diária, backup/restore, reinstalar rápido).
- **Checklist Go Live:** antes de considerar o sistema no ar, use o checklist em **docs/RUNBOOK_INTRANET.md** (build, acesso vulpetax.local, login, migrações, backup e restore testados, firewall).

---

## 11. Resumo rápido

| Etapa | Comando / Ação |
|--------|-----------------|
| Banco | `docker compose up -d` |
| Migrações | `npm run db:migrate` |
| Build | `npm run build` |
| Produção 24/7 | `pm2 start ecosystem.config.js` → `pm2 save` → `pm2 startup` |
| Backup diário | `./backup.sh` + crontab `0 2 * * * /caminho/do/projeto/backup.sh` |
| Acesso | **http://vulpetax.local:3000** (após configurar mDNS no Mac) |
| Segurança | PASSCODE forte, auth ativa, sem DISABLE_AUTH, firewall rede privada |
