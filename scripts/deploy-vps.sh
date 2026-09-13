#!/usr/bin/env bash
# Deploy da Inteligência (auth + multi-tenant) para a produção existente.
# Atualiza o app gestao-buddha já no ar em gestao.buddhaspa.com.br.
#
# Uso (a partir da raiz do projeto, no Git Bash):
#   bash scripts/deploy-vps.sh
#
# O que faz, em ordem:
#   1. Empacota o código-fonte (sem node_modules/.next/dev.db/.env)
#   2. Faz BACKUP do banco de produção na VPS
#   3. Envia e extrai o código
#   4. Garante AUTH_SECRET no .env.local da VPS (gera se não existir)
#   5. npm install + npm run build
#   6. Semeia usuários/unidades no banco de produção (idempotente)
#   7. Reinicia o PM2
#   8. Valida (login exige sessão; /inteligencia redireciona)
set -euo pipefail

VPS="root@187.77.210.61"
KEY="$HOME/.ssh/id_vps"
APP="/var/www/apps/gestao-buddha"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "▶ 1/8  Empacotando código-fonte…"
TAR="/tmp/gestao-deploy-$STAMP.tgz"
tar \
  --exclude='./node_modules' --exclude='./.next' --exclude='./.git' \
  --exclude='./puppeteer-profile' --exclude='./cache' \
  --exclude='*.db' --exclude='*.db-journal' --exclude='*.db-wal' --exclude='*.db-shm' \
  --exclude='.env' --exclude='.env.*' --exclude='*.log' --exclude='./*-debug.png' \
  --exclude='./navvii-*.png' --exclude='./wp-step*.png' --exclude='./login-debug.png' \
  -czf "$TAR" -C "$(pwd)" .
echo "   pacote: $TAR ($(du -h "$TAR" | cut -f1))"

echo "▶ 2/8  Backup do banco de produção na VPS…"
$SSH "$VPS" "cp $APP/dev.db $APP/dev.db.bak-$STAMP && ls -la $APP/dev.db.bak-$STAMP"

echo "▶ 3/8  Enviando e extraindo o código…"
scp -i "$KEY" -o StrictHostKeyChecking=no "$TAR" "$VPS:/tmp/"
$SSH "$VPS" "tar -xzf /tmp/$(basename "$TAR") -C $APP && rm -f /tmp/$(basename "$TAR")"

echo "▶ 4/9  Garantindo AUTH_SECRET, CRON_SECRET e integração LeadFlow no .env.local…"
$SSH "$VPS" "cd $APP && \
  (grep -q '^AUTH_SECRET=' .env.local 2>/dev/null && echo '   AUTH_SECRET já existe' || { S=\$(node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"); printf '\n# Auth (Inteligência)\nAUTH_SECRET=%s\n' \"\$S\" >> .env.local; echo '   AUTH_SECRET gerado'; }) && \
  (grep -q '^CRON_SECRET=' .env.local 2>/dev/null && echo '   CRON_SECRET já existe' || { C=\$(node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"); printf 'CRON_SECRET=%s\n' \"\$C\" >> .env.local; echo '   CRON_SECRET gerado'; }) && \
  (grep -q '^LEADFLOW_SYNC_ENABLED=' .env.local 2>/dev/null || printf '\n# Integração LeadFlow (espelhar mensagens) — DESLIGADA até validarmos\nLEADFLOW_SYNC_ENABLED=false\n' >> .env.local) && \
  (grep -q '^LEADFLOW_URL=' .env.local 2>/dev/null || echo 'LEADFLOW_URL=http://localhost:3850' >> .env.local) && \
  (grep -q '^ERP_INTEGRATION_KEY=' .env.local 2>/dev/null || { K=\$(grep '^ERP_INTEGRATION_KEY=' /var/www/apps/leadflow/backend/.env 2>/dev/null | cut -d= -f2-); [ -n \"\$K\" ] && echo \"ERP_INTEGRATION_KEY=\$K\" >> .env.local && echo '   ERP_INTEGRATION_KEY copiada do LeadFlow'; }) && \
  echo '   integração LeadFlow configurada (OFF)'"

echo "▶ 5/9  npm install + prisma + tabelas (mensagens + rotinas) + build…"
$SSH "$VPS" "cd $APP && npm install --no-audit --no-fund && npx prisma generate && DATABASE_URL=file:$APP/dev.db node scripts/criar-tabela-templates.mjs && DATABASE_URL=file:$APP/dev.db node scripts/criar-tabelas-rotinas.mjs && npm run build"

echo "▶ 6/9  Semeando usuários/unidades (idempotente)…"
$SSH "$VPS" "cd $APP && node scripts/seed-usuarios.mjs"

echo "▶ 7/9  Instalando cron de sistema (sync a cada 3h)…"
$SSH "$VPS" "cd $APP && \
  SECRET=\$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-) && \
  LINE=\"0 */3 * * * curl -s -X POST -H 'x-cron-secret: \$SECRET' http://localhost:3000/api/cron/sync >> /var/log/gestao-sync.log 2>&1\" && \
  ( crontab -l 2>/dev/null | grep -v 'api/cron/sync'; echo \"\$LINE\" ) | crontab - && \
  echo '   cron instalado:' && crontab -l | grep 'api/cron/sync'"

echo "▶ 8/9  Reiniciando PM2…"
$SSH "$VPS" "pm2 restart gestao-buddha --update-env && pm2 save"

echo "▶ 9/9  Validando…"
$SSH "$VPS" "sleep 3; \
  echo -n '  /inteligencia sem sessão (307): '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/inteligencia; \
  echo -n '  /login (200): '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login; \
  echo -n '  /rotina-do-dia sem sessão (307): '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/rotina-do-dia; \
  echo -n '  /api/rotinas sem sessão (401): '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/rotinas; \
  echo -n '  /api/cron/sync sem token (401): '; curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/cron/sync"

echo "✅ Deploy concluído. Guarde as senhas impressas no passo 6."
