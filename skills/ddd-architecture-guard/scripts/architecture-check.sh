#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required for this script."
  exit 1
fi

echo "Running DDD architecture checks in: ${ROOT_DIR}"
echo

echo "[1/4] Domain importing app/infra/interfaces"
rg -n --glob '*.ts' \
  '(from|import).*server/(application|infra|interfaces)|from\s+["'\'']\.\./\.\./(application|infra|interfaces)' \
  "${ROOT_DIR}/server/domain" || true
echo

echo "[2/4] Application importing interfaces"
rg -n --glob '*.ts' \
  '(from|import).*server/interfaces|from\s+["'\'']\.\./\.\./interfaces' \
  "${ROOT_DIR}/server/application" || true
echo

echo "[3/4] Application importing infra implementations"
rg -n --glob '*.ts' \
  '(from|import).*server/infra|from\s+["'\'']\.\./\.\./infra' \
  "${ROOT_DIR}/server/application" || true
echo

echo "[4/4] Domain importing common persistence hints"
rg -n --glob '*.ts' \
  '(drizzle|typeorm|prisma|knex|sequelize|sqlite|pg|mysql)' \
  "${ROOT_DIR}/server/domain" || true
echo

echo "Done. Review hits above; some may be false positives."
