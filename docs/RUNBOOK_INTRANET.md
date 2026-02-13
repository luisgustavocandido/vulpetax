# VulpeTax — Runbook Intranet

Comandos essenciais para operar o VulpeTax em ambiente interno (LAN). Detalhes em **docs/INTRANET_SETUP.md**.

---

## Start / Stop

### Docker (PostgreSQL)

```bash
# Subir banco
docker compose up -d

# Parar banco (dados permanecem no volume)
docker compose down

# Ver status
docker ps
```

### PM2 (Next.js)

```bash
# Iniciar (após npm run build)
pm2 start ecosystem.config.js

# Parar
pm2 stop vulpetax

# Reiniciar
pm2 restart vulpetax

# Status
pm2 status

# Logs em tempo real
pm2 logs vulpetax
```

---

## Rotina diária

1. **PM2** — `pm2 status` → processo `vulpetax` deve estar **online**.
2. **Docker** — `docker ps` → container `vulpetax-postgres` deve estar **Up** (e **healthy** se healthcheck ativo).
3. **Espaço em disco** — `df -h` e verificar tamanho de `./backups/`.

---

## Backup / Restore

### Fazer backup

```bash
./backup.sh
```

Arquivo gerado em `./backups/vulpetax_YYYY-MM-DD_HHMMSS.sql`.

### Restaurar backup

Com o container rodando e o arquivo de backup (ex.: `backups/vulpetax_2026-02-12_020000.sql`):

```bash
docker exec -i vulpetax-postgres psql -U user vulpetax < backups/vulpetax_2026-02-12_020000.sql
```

Ajuste `user`, `vulpetax` e o nome do arquivo conforme seu ambiente. Em banco já populado, pode ser necessário dropar/recrear antes do restore.

---

## Reinstalar rápido (mesma máquina)

1. `pm2 delete vulpetax` (se existir).
2. `docker compose down` (opcional; manter se quiser preservar dados).
3. `npm install`
4. `docker compose up -d`
5. `npm run db:migrate` **ou** restaurar último backup (comando acima).
6. `npm run build`
7. `pm2 start ecosystem.config.js`
8. `pm2 save`

---

## Checklist Go Live (antes de considerar “no ar”)

- [ ] **Build** — `npm run build` conclui sem erro.
- [ ] **App acessível** — Abrir **http://vulpetax.local:3000** (ou http://\<IP-do-Mac\>:3000) no navegador.
- [ ] **Login** — Login com PASSCODE funciona; não usar DISABLE_AUTH em produção.
- [ ] **Migrações** — `npm run db:migrate` já executado; tabelas existem.
- [ ] **Backup testado** — `./backup.sh` gera arquivo em `./backups/`.
- [ ] **Restore testado** — Restaurar um backup de teste (ex.: em outro DB ou container) com o comando `docker exec -i vulpetax-postgres psql ...` da seção acima.
- [ ] **Firewall** — Porta 3000 liberada na rede local (macOS: Preferências do Sistema → Firewall; permitir Node na rede privada).

Quando todos os itens estiverem ok, o ambiente está pronto para uso em intranet.
