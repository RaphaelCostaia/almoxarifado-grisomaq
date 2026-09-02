#!/bin/sh
set -e

# 1. Limpa duplicatas primeiro (senão as constraints falham ao aplicar)
echo "[grisomaq] Limpando duplicatas legadas (se houver)…"
if ! npx --no-install tsx db/cleanup-duplicates.ts; then
  echo "[grisomaq] cleanup falhou (talvez tabelas não existam ainda), continuando."
fi

# 2. Aplica constraints via SQL puro (evita prompt interativo do drizzle-kit push)
echo "[grisomaq] Aplicando constraints via SQL…"
if ! npx --no-install tsx db/apply-constraints.ts; then
  echo "[grisomaq] apply-constraints falhou, continuando."
fi

# 3. drizzle-kit push — agora deve encontrar "no changes" e passar limpo
echo "[grisomaq] Verificando schema (drizzle push)…"
if ! yes "" 2>/dev/null | npx --no-install drizzle-kit push --force; then
  echo "[grisomaq] drizzle-kit push falhou. Continuando mesmo assim."
fi

# 4. Seed idempotente
echo "[grisomaq] Rodando seed idempotente…"
if ! npx --no-install tsx db/seed.ts; then
  echo "[grisomaq] seed falhou."
fi

# 5. Seed frotas (idempotente, importa 266 registros da GRISOMAQ)
if [ -f db/seed-frotas.json ]; then
  echo "[grisomaq] Rodando seed-frotas idempotente…"
  if ! npx --no-install tsx db/seed-frotas.ts; then
    echo "[grisomaq] seed-frotas falhou."
  fi
else
  echo "[grisomaq] db/seed-frotas.json não encontrado, pulei."
fi

# 6. Seed peças (idempotente, importa catálogo do GMAIS ~14k peças)
if [ -f db/seed-pecas.json ]; then
  echo "[grisomaq] Rodando seed-pecas idempotente…"
  if ! npx --no-install tsx db/seed-pecas.ts; then
    echo "[grisomaq] seed-pecas falhou."
  fi
else
  echo "[grisomaq] db/seed-pecas.json não encontrado, pulei."
fi

echo "[grisomaq] Subindo Next.js…"
exec "$@"
