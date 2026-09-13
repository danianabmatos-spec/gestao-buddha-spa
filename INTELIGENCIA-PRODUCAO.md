# Inteligência → Produção — Documentação de Construção

**Última atualização:** 2026-08-12
**App:** `gestao-buddha-spa` (Next 16, porta 3002 local / 3000 na VPS)
**Produção:** já no ar em `gestao.solcentral.com.br` (PM2 `gestao-buddha`, `/var/www/apps/gestao-buddha`)

Este documento registra tudo que foi construído para levar o módulo **Inteligência** a produção
como sistema **multi-tenant** das 7 unidades, integrado ao **LeadFlow**.

---

## Decisões tomadas (Daniana)

- **Acesso:** perfil **DONA** vê as 7 unidades; **RECEPÇÃO** só a própria unidade.
- **WhatsApp:** começar **semi-automático** (recepção clica → envia); futuro: campanha em massa.
- **Integração LeadFlow:** LeadFlow como **serviço de mensageria** (ERP segmenta, LeadFlow entrega/registra); **tag por unidade**.
- **Fase de teste:** **NENHUM disparo real a cliente** — tudo arquitetado e desligado até validarmos juntos.
- **Publicação:** "prepara tudo, publico depois" (deploy não executado; script pronto).

---

## Fase 1 — Segurança & Multi-tenant ✅

Autenticação JWT (`jose`) + `bcrypt`, no padrão do LeadFlow.

**Arquivos novos:**
- `src/lib/auth/session.ts` — assina/verifica JWT (cookie `bs_sess`, 30d)
- `src/lib/auth/password.ts` — hash/verificação bcrypt
- `src/lib/auth/guard.ts` — `getSession`, `unauthorized`, `resolveUnidade`, `unidadeEfetiva` (**coração do multi-tenant**)
- `src/app/login/page.tsx` — tela de login
- `src/app/api/auth/{login,logout,me}/route.ts`
- `src/proxy.ts` — protege `/inteligencia`, `/trocar-senha`, `/api/inteligencia/*` (convenção "proxy" do Next 16; fica em `src/`, não na raiz)
- `scripts/seed-usuarios.mjs` — cria 7 unidades + DONA + 1 recepção por unidade (senhas temporárias aleatórias; `--reset-senhas` regenera)

**Regra de escopo:** as 5 rotas `api/inteligencia/*` resolvem a unidade pela **sessão**, não pelo `?unidade=`. DONA escolhe; recepção fica travada na dela.

**Perfis / login:**
- DONA: `buddhaspasolar@gmail.com` (unidadeSlug null = vê todas)
- Recepção: `recepcao.<slug>@buddhaspa.com.br` (travada na unidade)
- Senhas: geradas pelo seed (não versionadas). Tela `/trocar-senha` permite a troca.

---

## Fase 1.5 — Criptografia das senhas Belle + Trocar senha ✅

- `src/lib/auth/crypto.ts` — AES-256-GCM (`BELLE_ENC_KEY`), com `maybeDecrypt` retrocompatível (texto puro passa direto).
- `unidades-config.ts` — decripta a senha do Belle na leitura.
- `scripts/encriptar-senhas-belle.mjs` — converte as senhas do `.env.local` para `enc:v1:...` (idempotente, com backup).
- `src/app/api/auth/change-password/route.ts` + `src/app/trocar-senha/page.tsx` — troca de senha (mín. 8 chars, valida senha atual).

---

## Fase 2 — Higiene & Deploy ✅ (deploy preparado, não executado)

- **`next build` verde:** corrigidos os 12 erros de TypeScript pré-existentes (vouchers/scrapers/prisma seed) — nenhum era da Inteligência.
- **`.gitignore`** passou a ignorar `*.db`, `*.log`, `*-debug.png`, etc.
- **Script de deploy:** `scripts/deploy-vps.sh` (roda do Git Bash local). 9 passos:
  1. empacota o fonte (tar, sem node_modules/.next/dev.db/.env) — ~550 KB
  2. **backup do dev.db de produção**
  3. envia e extrai
  4. provisiona `AUTH_SECRET`, `CRON_SECRET` e integração LeadFlow (OFF) no `.env.local`
  5. `npm install` + `prisma generate` + cria tabelas + `npm run build`
  6. `node scripts/seed-usuarios.mjs`
  7. instala **cron de sistema** (`0 */3 * * *`)
  8. `pm2 restart gestao-buddha --update-env`
  9. valida
- **Impacto ao publicar:** `/inteligencia` passa a exigir login (só essa área). Recepções ainda não usam → deploy sem risco de travar ninguém.

---

## Cron de sincronização robusto ✅

- `src/app/api/cron/sync/route.ts` — fora do login, autenticado por `CRON_SECRET` (header `x-cron-secret` ou `?token=`). Dispara o sync das 7 unidades em background.
- `scheduler.ts` — desativa o agendador in-process (`setInterval`) quando `CRON_SECRET` existe (evita sync duplo).
- Cron de sistema na VPS chama o endpoint a cada 3h → `/var/log/gestao-sync.log`.

---

## Mensagens editáveis por cluster ✅

- `mensagens.ts` — 13 clusters (`CLUSTERS_MENSAGEM`), `resolverCluster`, `renderMensagem` (`{nome}`, `{dias}`), `gerarMensagemWhatsApp(...templates?)`.
  - **Pacote (8 status):** ATIVO (convite p/ agendar), A_VENCER, **FINALIZADO_30/90/180/PLUS** (0 sessões, por dias desde a ÚLTIMA SESSÃO), **VENCIDO_ATE30** (uso grátis em até 30 dias do vencimento) e **VENCIDO_MAIS30** (reativar sessões com 20% do valor).
  - Fila (`page.tsx`): pacotes agrupados em 3 blocos visuais — **Atuais / Finalizados / Vencidos** (`TabsRowPacote`). scores busca todos os clientes com pacote (2 queries) para nenhum ficar cortado.
- Model `TemplateMensagem` (`cluster @id`, `texto`, `updatedAt`).
- API `src/app/api/inteligencia/mensagens/route.ts` — GET (todos logados) / PUT (só DONA; salvar ou restaurar padrão).
- UI: aba **✏️ Mensagens** (`inteligencia/mensagens/page.tsx`) — editor com prévia e variáveis; read-only p/ recepção. A Fila usa os textos editados.

---

## Integração ERP → LeadFlow (Nível 1: espelhar) ✅ — DESLIGADA

Espelha no LeadFlow as mensagens enviadas pelo ERP. **Só registra histórico, nunca contata o cliente.**

- **ERP:** model `LeadFlowOutbox` (fila) + `src/lib/integracoes/leadflow.ts` (`enfileirarMensagem`, `processarOutbox` gated por `LEADFLOW_SYNC_ENABLED`, `statusOutbox`). `/api/inteligencia/contato` enfileira; `/api/cron/sync` e `/api/inteligencia/leadflow-status` (DONA) drenam/monitoram.
- **LeadFlow (VPS):** `backend/src/api/routes/erp.ts` — `POST /api/erp/mensagem` (auth `x-erp-key`; upsert lead por telefone + **tag = unidade** + conversa em canal virtual `erp` + mensagem outbound). **Staged no src — LeadFlow ainda NÃO foi rebuildado.**
- **Confiabilidade:** padrão **outbox** (retenta até 5x; nada se perde).
- **Ativar (teste coordenado):** rebuild+restart do LeadFlow na VPS → ligar `LEADFLOW_SYNC_ENABLED=true` no ERP.

---

## Trava anti-mensagem-errada ✅

Impede mandar mensagem errada a cliente que está em mais de um cluster (ex.: pacote finalizado **e** ativo).

- `relatorio-clientes.ts` — detecta `temPlanoAtivo` (algum plano com sessão sobrando E validade futura); agrega por **ID do cliente** (fallback nome).
- `motor.ts` — casa plano↔cliente por ID; grava `ClienteScore.temPacoteAtivo` (coluna nova, ALTER TABLE aditivo).
- `mensagens.ts` — `motivoSupressao`: **regra única** — bloqueia só quem tem **agendamento futuro** (ele já vem). Cliente com **pacote ATIVO sem agendamento** É contatado (cluster `PACOTE_ATIVO` = convite pra agendar/usar as sessões). A_VENCER/FINALIZADO/VENCIDO recebem lembrete/renovação. *(Histórico 2026-08-13: a regra por `temPacoteAtivo`+cluster estava invertida (bloqueava A_VENCER); depois passou a bloquear ATIVO; ajuste final: ATIVO sem agenda deve ser convidado a agendar, então só agendamento futuro bloqueia.)*
- `scores/route.ts` — devolve `cluster`, `bloqueado`, `motivoBloqueio`. `contato/route.ts` — **guard 409** (vale mesmo se a UI for burlada). `page.tsx` — mostra 🚫 no lugar dos botões.

### Garantia "1 cluster por cliente"
A fila segue a **cascata** (pacote > frequente-sem-pacote > frequência): cada cliente aparece em **um único** cluster. `filtrarCliente` (page.tsx) e as contagens (scores route) excluem quem tem pacote / é frequente-sem-pacote das abas de frequência. Verificado: 0 clientes em >1 aba.

### Pacotes suspensos (Belle status "suspenso")
Suspenso = **não utilizável** (como finalizado), mas caso **delicado**. `relatorio-clientes.ts` detecta `suspens*`: não conta sessão utilizável, não marca ativo, não influencia validade; marca `temPlanoSuspenso` → `ClienteScore.temPacoteSuspenso`. Decisão: **avisar mas permitir enviar** — badge ⚠️ "Suspenso" na fila, botão de envio segue ativo (não bloqueia).

---

## Agendamentos futuros ✅

- `client.ts` — `getNomesComAgendamentoFuturo(email,senha,estab,dias)` — versão **leve** (reusa token+grid, pula `getTurnos`). Retorna nomes com agendamento (Marcado/Confirmado/Aguardando) nos próximos N dias.
- `motor.ts` — busca em paralelo (best-effort) e grava `temAgendamentoFuturo`. Janela: env `AGENDAMENTOS_FUTUROS_DIAS` (default 7; 0 desativa). Casamento por nome.

---

## Cluster TotalPass ✅

Base de clientes que pagam com **TotalPass** (2 sessões de 60 min/mês) — convidá-los a agendar.
- **Fonte:** Report BI **103** ("Movimentação - Detalhado"), filtros Confirmação + Período (ano) + Forma de Pagamento `Parcerias Comerciais - TotalPass` (`src/lib/belle/movimentacao.ts`). Sessões do mês contadas pela **agenda** (`getSessoesMesPorCliente` em client.ts).
- **Tabela** `ClienteTotalPass` (por unidade), atualizada no fim de `calcularScoresUnidade` (best-effort). Campos manuais `planoCancelado` e `ultimoContato` **não são sobrescritos**.
- **Subclusters:** 0/2 (convidar p/ 2), 1/2 (convidar p/ a 2ª), 2/2 (completo), **sem plano** (manual).
- **UI:** aba **🎫 TotalPass** → `inteligencia/totalpass/page.tsx`. Botão WhatsApp com mensagem editável (clusters `TOTALPASS_2`/`TOTALPASS_1`) + botão **"Sem plano"** (recepção marca quando o cliente cancela o TotalPass → para de receber msg; reversível). API: `src/app/api/inteligencia/totalpass/route.ts`.

## Variáveis de ambiente (produção / VPS)

| Var | Papel | Observação |
|-----|-------|-----------|
| `AUTH_SECRET` | Assina a sessão JWT | Gerada no deploy se faltar |
| `BELLE_ENC_KEY` | Decripta senhas Belle | Só necessária se as senhas estiverem `enc:` |
| `CRON_SECRET` | Autentica o cron de sync | Gerada no deploy |
| `LEADFLOW_SYNC_ENABLED` | Liga/desliga o espelhamento | **false** por padrão |
| `LEADFLOW_URL` | Endereço do LeadFlow | `http://localhost:3850` na VPS |
| `ERP_INTEGRATION_KEY` | Chave ERP↔LeadFlow | Mesma nos dois; copiada do LeadFlow no deploy |
| `AGENDAMENTOS_FUTUROS_DIAS` | Janela de agenda | Default 7 |

> ⚠️ Segredos ficam apenas no `.env.local` da VPS (gitignored). Nunca versionar.

---

## Como publicar (quando a Daniana autorizar)

```bash
cd C:/Users/MADISHAR/gestao-buddha-spa
bash scripts/deploy-vps.sh
# anotar as senhas impressas no passo 6
```

Para o **teste coordenado da integração LeadFlow** (depois do deploy):
1. Na VPS: `cd /var/www/apps/leadflow/backend && npm run build && pm2 restart leadflow`
2. No ERP (VPS): `LEADFLOW_SYNC_ENABLED=true` no `.env.local` + `pm2 restart gestao-buddha --update-env`
3. Registrar 1 contato de teste e conferir no LeadFlow (lead + tag + mensagem outbound).

---

## Nível 2A (whatsapp-web.js) — TESTADO E DESCARTADO (2026-08-13)

Tentamos conectar o WhatsApp da unidade no LeadFlow via `whatsapp-web.js` (QR/aparelho conectado).
**Não funciona:** o WhatsApp **bloqueia o pareamento** — o cliente linka por um instante (cria a
pasta de sessão, aparece na lista do celular) e o servidor recebe `Disconnected: LOGOUT` na
sequência, **nunca chegando a `authenticated`/`ready`**. É a detecção anti-automação da Meta.
Testado com: versão nova e intermediária do WhatsApp Web (`webVersionCache` fixado), relógio da
VPS sincronizado, sessão limpa. Não é bug de config nosso.

- **Decisão:** ficar no **Nível 1 (manual)**, que já está no ar e funciona.
- **Cleanup:** a inicialização do `whatsapp-web.js` no LeadFlow ficou atrás do flag
  `WHATSAPP_WEB_ENABLED` (padrão **desligado**) em `backend/src/server.ts` — parou o loop de
  QR + Chromium. `webVersionCache` fixado permanece no `whatsapp.ts` (inócuo).
- **Caminho durável p/ automação futura:** **WhatsApp Cloud API (2B)** — sem QR, sem banimento,
  suportado pela Meta; exige conta Meta Business + número Business dedicado + templates aprovados
  e tem custo por conversa.

## Pendências / próximos passos

- [ ] **Teste coordenado na VPS** (sync real popula `temPacoteAtivo`/`temAgendamentoFuturo`; validar contra Belle acessível).
- [ ] **Publicar** (deploy) quando autorizado.
- [ ] Rebuild do LeadFlow + ligar o espelhamento (Nível 1) — teste controlado.
- [ ] **Nível 2** (envio real via LeadFlow) — Fase 3 do plano.
- [ ] `git rm --cached dev.db` + limpeza do histórico (contém PII de cliente) — decisão da Daniana.
- [ ] Proteger endpoints antigos `/api/vouchers/seed-*` e `debug-*` (públicos; risco pré-existente).
- [ ] Instagram no LeadFlow (parte da Meta é da Daniana).

---

## Notas de teste

- Todo o fluxo de auth, escopo por unidade, criptografia, mensagens, cron, integração (contra mock) e trava foi **testado localmente** e o **build de produção passa**.
- O sync ao Belle **falha intermitentemente no ambiente local** ("fetch failed") — é rede, não código. Validar `temPacoteAtivo`/`temAgendamentoFuturo` na VPS.
