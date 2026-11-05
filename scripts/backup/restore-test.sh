#!/usr/bin/env sh
# Restaura um backup num banco TEMPORARIO e confere contagens: prova que o backup serve.
# Uso: ADMIN_URL=postgresql://user:pass@host:5432/postgres ./scripts/backup/restore-test.sh arquivo.dump
# Nunca aponte ADMIN_URL para o banco de producao como alvo de restore: o script cria e apaga
# um banco proprio (rd_restore_test_<timestamp>).
set -eu
: "${ADMIN_URL:?defina ADMIN_URL (conexao com permissao de CREATE DATABASE)}"
FILE="${1:?informe o arquivo .dump}"
if [ -f "$FILE.sha256" ]; then sha256sum -c "$FILE.sha256"; fi
DB="rd_restore_test_$(date -u +%s)"
BASE="${ADMIN_URL%/*}"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB"
trap 'psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS $DB" >/dev/null' EXIT
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$BASE/$DB" "$FILE"
psql "$BASE/$DB" -v ON_ERROR_STOP=1 -At -c "
  SELECT 'users', count(*) FROM users UNION ALL
  SELECT 'products', count(*) FROM products UNION ALL
  SELECT 'product_variants', count(*) FROM product_variants UNION ALL
  SELECT 'orders', count(*) FROM orders UNION ALL
  SELECT 'migrations', count(*) FROM _prisma_migrations;"
echo "restore OK em $DB (sera apagado ao sair)"
