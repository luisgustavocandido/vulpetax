#!/usr/bin/env bash
# Backup do banco PostgreSQL usando DATABASE_URL do .env
# Uso: ./scripts/backup-database.sh
# Gera: backup_YYYYMMDD_HHMMSS.sql na raiz do projeto (ou em ./backups/ se existir)

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Arquivo .env não encontrado. Crie a partir de .env.example."
  exit 1
fi

# Carrega apenas DATABASE_URL (evita problemas com aspas/senhas no .env)
DATABASE_URL=$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
export DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL não definido no .env"
  exit 1
fi

# pg_dump: usar do PATH ou do Homebrew (libpq)
if ! command -v pg_dump >/dev/null 2>&1; then
  if [ -x "/opt/homebrew/opt/libpq/bin/pg_dump" ]; then
    export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
  elif [ -x "/usr/local/opt/libpq/bin/pg_dump" ]; then
    export PATH="/usr/local/opt/libpq/bin:$PATH"
  fi
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump não encontrado. Instale as ferramentas do PostgreSQL:"
  echo "  macOS (Homebrew):  brew install libpq"
  echo "  Depois adicione ao PATH:  export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
  exit 1
fi

mkdir -p backups 2>/dev/null || true
OUTPUT_DIR="${BACKUP_DIR:-backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="${OUTPUT_DIR}/backup_${STAMP}.sql"

echo "Gerando backup em $FILE ..."
pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$FILE"
echo "Backup concluído: $FILE"
echo "Copie este arquivo para o outro PC se quiser restaurar os dados lá."
