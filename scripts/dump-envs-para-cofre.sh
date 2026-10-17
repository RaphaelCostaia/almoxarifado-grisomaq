#!/bin/bash
# Dump das env vars dos services críticos num formato pronto pra colar
# num gerenciador de senhas (1Password, Bitwarden, LastPass).
#
# USO: ssh root@<vps> 'bash -s' < scripts/dump-envs-para-cofre.sh
# ou simplesmente, no SSH do VPS:
#   bash dump-envs-para-cofre.sh > envs-backup.txt
#
# Depois COPIA o resultado pro cofre de senhas (ou um .env.secret OFFLINE)
# e APAGA o arquivo do servidor:
#   shred -u envs-backup.txt
#
# ⚠ ARQUIVO CONTÉM SENHAS EM TEXTO PURO. Trata com cuidado.

set -e

timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
hostname=$(hostname)

cat <<EOF
# =============================================================
# Env vars dos services GRISOMAQ — snapshot
# Gerado em: $timestamp
# Host: $hostname
# =============================================================
# Como restaurar: copiar bloco inteiro de cada service no EasyPanel
# → projeto → service → Environment → colar → Deploy.
# =============================================================

EOF

for svc in grisomaq_almoxarifado-grisomaq grisomaq_db grisomaq_controle grisomaq_github grisomaq_grisomaq_rh; do
  if docker service inspect "$svc" >/dev/null 2>&1; then
    echo "## Service: $svc"
    echo '```'
    docker service inspect "$svc" \
      --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}'
    echo '```'
    echo ""
  fi
done

cat <<EOF

# =============================================================
# Fim do dump
# =============================================================
# Próximos passos:
#   1. Copie TUDO acima para um item no cofre de senhas
#      (nome sugerido: "GRISOMAQ VPS — Env Vars $timestamp")
#   2. APAGUE este arquivo: shred -u <arquivo>
#   3. Agende um lembrete pra rodar isso de novo a cada 30 dias
#      ou após qualquer mudança nas variáveis.
EOF
