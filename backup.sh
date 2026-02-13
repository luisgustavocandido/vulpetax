#!/usr/bin/env bash
#
# Backup diário do PostgreSQL (VulpeTax — intranet).
# Requer: Docker com container vulpetax-postgres rodando.
# Uso: ./backup.sh  ou  crontab: 0 2 * * * /caminho/do/projeto/backup.sh
#
# Opcional: defina no ambiente ou .env do sistema:
#   POSTGRES_USER=user  POSTGRES_DB=vulpetax

set -e

CONTAINER="${PG_CONTAINER:-vulpetax-postgres}"
PGUSER="${POSTGRES_USER:-user}"
PGDB="${POSTGRES_DB:-vulpetax}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
DATE="$(date +%Y-%m-%d_%H%M%S)"
FILE="${BACKUP_DIR}/vulpetax_${DATE}.sql"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Erro: container ${CONTAINER} não está rodando. Execute: docker compose up -d"
  exit 1
fi

echo "Backup: ${FILE}"
docker exec "$CONTAINER" pg_dump -U "$PGUSER" "$PGDB" > "$FILE"

if [ -s "$FILE" ]; then
  echo "OK: $(wc -l < "$FILE") linhas."
else
  echo "Erro: arquivo de backup vazio."
  rm -f "$FILE"
  exit 1
fi

# Retenção opcional: manter últimos N dias (ex.: KEEP_DAYS=30)
KEEP_DAYS="${KEEP_DAYS:-0}"
if [ "$KEEP_DAYS" -gt 0 ] 2>/dev/null; then
  find "$BACKUP_DIR" -name "vulpetax_*.sql" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
fi
