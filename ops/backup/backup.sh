#!/bin/bash
# Daemon de backup diário — GRISOMAQ.
#
# Backupeia:
#   1. Postgres inteiro (pg_dump -Fc) → /backups/db/grisomaq-<ts>.dump
#   2. Volume de uploads (tar.gz)     → /backups/uploads/uploads-<ts>.tar.gz
#
# Retenção: RETENCAO_DIAS (default 14). Rotação apaga arquivos mais antigos.
# Horário:  HORA_BACKUP em formato HH (default "03"), fuso do container ($TZ).
# Loga em stdout → EasyPanel captura.
#
# Modo one-shot pra teste: rodar com BACKUP_AGORA=1.
set -eu
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
HORA_BACKUP="${HORA_BACKUP:-03}"
BACKUP_DIR="/backups"
UPLOADS_SRC="/uploads/uploads"

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/uploads"

fazer_backup() {
  local ts db_file up_file
  ts=$(date +%Y-%m-%d_%H%M%S)
  db_file="$BACKUP_DIR/db/grisomaq-$ts.dump"
  up_file="$BACKUP_DIR/uploads/uploads-$ts.tar.gz"

  echo "[backup $ts] pg_dump -Fc do database $POSTGRES_DB…"
  if pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$db_file"; then
    echo "[backup $ts]   -> $(ls -lh "$db_file" | awk '{print $5, $NF}')"
  else
    echo "[backup $ts] FALHA no pg_dump. Ver logs acima."
    rm -f "$db_file"
    return 1
  fi

  if [ -d "$UPLOADS_SRC" ] && [ -n "$(ls -A "$UPLOADS_SRC" 2>/dev/null || true)" ]; then
    echo "[backup $ts] tar.gz de $UPLOADS_SRC…"
    if tar -C "$UPLOADS_SRC" -czf "$up_file" .; then
      echo "[backup $ts]   -> $(ls -lh "$up_file" | awk '{print $5, $NF}')"
    else
      echo "[backup $ts] FALHA no tar de uploads."
      rm -f "$up_file"
    fi
  else
    echo "[backup $ts] uploads vazio/ausente, pulei."
  fi

  echo "[backup $ts] removendo backups com mais de $RETENCAO_DIAS dias…"
  find "$BACKUP_DIR/db"      -type f -name '*.dump'   -mtime +"$RETENCAO_DIAS" -print -delete || true
  find "$BACKUP_DIR/uploads" -type f -name '*.tar.gz' -mtime +"$RETENCAO_DIAS" -print -delete || true

  echo "[backup $ts] estado atual:"
  echo "   DB dumps:      $(ls -1 "$BACKUP_DIR/db"      2>/dev/null | wc -l | tr -d ' ')"
  echo "   Uploads tars:  $(ls -1 "$BACKUP_DIR/uploads" 2>/dev/null | wc -l | tr -d ' ')"
  echo "   Espaço total:  $(du -sh "$BACKUP_DIR" | awk '{print $1}')"
  echo "[backup $ts] concluído."
}

# Modo one-shot pra teste/manual
if [ "${BACKUP_AGORA:-0}" = "1" ]; then
  fazer_backup
  exit 0
fi

echo "[backup] Daemon iniciado."
echo "[backup] Fuso:           ${TZ:-UTC}"
echo "[backup] Horário diário: ${HORA_BACKUP}:00"
echo "[backup] Retenção:       ${RETENCAO_DIAS} dias"
echo "[backup] Dir:            $BACKUP_DIR"

echo "[backup] Executando snapshot inicial…"
fazer_backup || echo "[backup] snapshot inicial falhou — daemon continua"

while true; do
  ah=$(date +%H); am=$(date +%M); as=$(date +%S)
  agora=$(( 10#$ah * 3600 + 10#$am * 60 + 10#$as ))
  alvo=$(( 10#$HORA_BACKUP * 3600 ))
  if [ "$alvo" -le "$agora" ]; then
    dorme=$(( 86400 - agora + alvo ))
  else
    dorme=$(( alvo - agora ))
  fi
  echo "[backup] dormindo ${dorme}s até próximo ciclo (${HORA_BACKUP}:00)…"
  sleep "$dorme"
  fazer_backup || echo "[backup] ciclo falhou — tentando de novo no próximo dia"
done
