#!/usr/bin/env sh
# Backup logico do PostgreSQL (pg_dump formato custom, comprimido).
# Uso: DATABASE_URL=postgresql://... ./scripts/backup/backup.sh [pasta-destino]
# O arquivo contem dados pessoais (CPF cifrado, mas nome/endereco/e-mail em claro):
# guarde em local cifrado e com acesso restrito; retencao sugerida de 30 dias.
set -eu
: "${DATABASE_URL:?defina DATABASE_URL}"
DEST="${1:-./backups}"
mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/roupadedomingo-$STAMP.dump"
# pg_dump nao entende o parametro ?schema= do Prisma
URL="${DATABASE_URL%%\?*}"
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$URL"
sha256sum "$FILE" > "$FILE.sha256"
echo "backup: $FILE ($(wc -c < "$FILE") bytes)"
