# Deploy — Buddha Spa (gestão) na VPS

Regras que evitam derrubar a produção. **Leia antes de deployar.**

## 1. Deploy é SEMPRE por git (nunca copiar arquivo direto)

Editar local → `git commit` → `git push` → rodar `deploy.sh` no servidor.
**Nunca** `scp`/`tar`/pasta de rede: copiar direto apaga o trabalho do outro dev
e já derrubou a produção + apagou o git antes. Com todo mundo no `git push`,
ninguém sobrescreve ninguém.

- Local (Git Bash, chave `~/.ssh/id_vps`, clone `C:\Users\MADISHAR\gestao-buddha-spa`):
  `git pull --ff-only origin clean-main` **antes** de editar → editar →
  `git add -A && git commit && git push origin clean-main`.
- Servidor:
  ```bash
  cd /var/www/apps/gestao-buddha
  git fetch origin clean-main && git reset --hard origin/clean-main
  bash deploy.sh            # git pull → deps → prisma → tabelas → build; espera "BUILD OK"
  ```
- **Restart em comando SEPARADO** (nunca junto com o build):
  ```bash
  pm2 restart gestao-buddha --update-env && pm2 save
  ```
  Build && restart juntos num SSH que cai = app derrubado. Por isso `deploy.sh`
  **não** reinicia sozinho.

`.env`, `dev.db`, `node_modules/`, `.next/`, `uploads/`, `src/generated/` **nunca**
no git (moram só no servidor).

## 2. UM deploy por vez — FILA global (evita derrubar tudo)

A VPS é pequena (2 vCPU). **Dois `next build` ao mesmo tempo** (ex.: gestão + RH)
brigam por CPU e **corrompem o `.next` um do outro** → erro
`ENOENT ... _buildManifest.js.tmp` → o app **cai**. Já aconteceu (30/09/2026).

**Solução: cadeado global.** Todo `deploy.sh` pega o mesmo cadeado
`/var/lock/buddha-deploy.lock` antes de buildar. Se já tem um deploy rodando, o
segundo **espera na fila** e só entra quando o primeiro terminar. O `flock` solta
o cadeado sozinho no fim, no kill ou no crash — nunca fica travado.

> Na prática: pode dar `bash deploy.sh` mesmo com outro deploy rodando — ele
> imprime `aguardando a vez na FILA de deploy...` e espera. Não precisa combinar
> horário; a fila resolve.

### Bloco a copiar em TODO deploy.sh de app novo

Coloque logo no topo (depois do `cd` pra pasta do app), **antes** de qualquer
`git pull`/`npm install`/`build`:

```bash
# ── FILA GLOBAL DE DEPLOY (um deploy por vez em TODA a VPS) ──
DEPLOY_LOCK="/var/lock/buddha-deploy.lock"
if [ -z "${_BUDDHA_DEPLOY_LOCKED:-}" ] && command -v flock >/dev/null 2>&1; then
  export _BUDDHA_DEPLOY_LOCKED=1
  echo ">> aguardando a vez na FILA de deploy (cadeado global $DEPLOY_LOCK)..."
  exec flock "$DEPLOY_LOCK" bash "$0" "$@"
fi
echo ">> [fila] cadeado adquirido — deploy exclusivo nesta VPS."
```

Apps já com o cadeado: **gestão** (`deploy.sh`, `scripts/deploy-vps.sh`),
**buddha-rh** (`/root/deploy-buddha-rh.sh` no servidor). Ao criar/editar o
deploy de qualquer outro app (folha, central, etc.), **cole o bloco acima**.

## 3. Se o git pull for recusado

Alguém editou direto no servidor → `git status` → `git stash` → `deploy.sh`.
"dubious ownership" → `git config --global --add safe.directory <caminho>`.
