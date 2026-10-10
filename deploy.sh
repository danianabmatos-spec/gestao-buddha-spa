#!/usr/bin/env bash
# Deploy do gestão por git pull (substitui o tar+scp do deploy-vps.sh).
#
# Fluxo: editar local -> git commit -> git push -> rodar ESTE script no servidor.
# O `git pull --ff-only` RECUSA se o working dir do servidor tiver mudança não
# commitada -> impede sobrescrita silenciosa. NUNCA copie arquivo direto.
#
# LIÇÃO (igual folha): o restart fica SEPARADO do build. Se um SSH com timeout
# cortar no meio do build, o .next quebra e o app CAI. Rode este script (build)
# e SÓ DEPOIS, em comando separado:
#     pm2 restart gestao-buddha --update-env && pm2 save
#
# Conferir no ar:  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login  (espera 200)
set -euo pipefail
cd "$(dirname "$0")"
APP="$(pwd)"
DBURL="file:$APP/dev.db"
BRANCH="clean-main"

# ── FILA GLOBAL DE DEPLOY (um deploy por vez em TODA a VPS) ────────────────────
# Dois `next build` simultâneos (ex.: gestão + buddha-rh) brigam pelos 2 vCPU e
# corrompem o .next um do outro (erro ENOENT _buildManifest → o app CAI). Este
# cadeado põe os deploys em FILA: o segundo ESPERA o primeiro terminar e só então
# entra. Todos os apps usam o MESMO arquivo de lock. flock solta o cadeado sozinho
# no fim, no kill ou no crash — nunca fica travado. (Requer o mesmo bloco no
# deploy.sh de cada app: gestão, buddha-rh, folha, etc.)
DEPLOY_LOCK="/var/lock/buddha-deploy.lock"
if [ -z "${_BUDDHA_DEPLOY_LOCKED:-}" ] && command -v flock >/dev/null 2>&1; then
  export _BUDDHA_DEPLOY_LOCKED=1
  echo ">> aguardando a vez na FILA de deploy (cadeado global $DEPLOY_LOCK)..."
  exec flock "$DEPLOY_LOCK" bash "$0" "$@"
fi
echo ">> [fila] cadeado adquirido — deploy exclusivo nesta VPS."

echo ">> git pull --ff-only ($BRANCH)"
git pull --ff-only origin "$BRANCH"

echo ">> backup do dev.db"
[ -f dev.db ] && cp dev.db "dev.db.bak-$(date +%Y%m%d-%H%M%S)" || true
# mantém só os 5 backups mais recentes do dev.db
ls -1t dev.db.bak-* 2>/dev/null | tail -n +6 | xargs -r rm -f || true

echo ">> npm install"
npm install --no-audit --no-fund

echo ">> prisma generate"
npx prisma generate

echo ">> tabelas (idempotente — CREATE IF NOT EXISTS)"
for s in criar-tabela-templates criar-tabelas-rotinas criar-tabelas-recomendacao \
         criar-tabelas-atendimentos criar-tabela-fechamento-validacao criar-tabelas-venda \
         criar-tabelas-conciliacao criar-tabelas-nf-salao criar-tabelas-bola \
         criar-tabelas-parcerias-historico criar-tabela-parceria-conciliacao criar-tabela-nps-pendentes criar-tabelas-financeiro alterar-usuario-primeiro-acesso; do
  [ -f "scripts/$s.mjs" ] && { echo "   - $s"; DATABASE_URL="$DBURL" node "scripts/$s.mjs" >/dev/null 2>&1 || echo "     (aviso: $s retornou erro não-fatal)"; }
done

echo ">> build"
npm run build

echo ""
echo "BUILD OK — agora, em comando SEPARADO:  pm2 restart gestao-buddha --update-env && pm2 save"
