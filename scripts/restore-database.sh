#!/usr/bin/env bash
# Restaura um backup .sql no banco (usa DATABASE_URL do .env)
# Uso: ./scripts/restore-database.sh backups/backup_20250226_120000.sql
# ATENÇÃO: sobrescreve os dados atuais do banco.

set -e
cd "$(dirname "$0")/.."

if [ -z "$1" ] || [ ! -f "$1" ]; then
  echo "Uso: $0 <caminho-do-backup.sql>"
  echo "Ex.: $0 backups/backup_20250226_120000.sql"
  exit 1
fi

if [ ! -f .env ]; then
  echo "Arquivo .env não encontrado."
  exit 1
fi

DATABASE_URL=$(grep '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
export DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL não definido no .env"
  exit 1
fi

echo "Restaurando $1 em $DATABASE_URL (dados atuais serão sobrescritos)."
read -p "Continuar? (s/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[sS]$ ]]; then
  echo "Cancelado."
  exit 0
fi

psql "$DATABASE_URL" -f "$1"
echo "Restauração concluída."
