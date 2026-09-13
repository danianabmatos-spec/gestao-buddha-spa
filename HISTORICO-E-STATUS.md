# 📊 Gestão Buddha Spa (ERP) — Histórico & Status

**Workspace Maestri:** Gestão Buddha Spa
**Pasta:** `C:/Users/MADISHAR/gestao-buddha-spa`
**Atualizado em:** 2026-08-19

---

## 🎯 O que é
ERP / painel de gestão das **7 unidades Buddha Spa**. Centraliza indicadores
operacionais (caixa, vendas, metas, NPS, avaliações Google) e o módulo de
**Inteligência** de reativação de clientes. É o sistema-mãe para onde os demais
apps (RH, Folha) convergem.

- **Stack:** Next.js 16 + React 19 · Prisma · Tailscale/ShadCN UI · TypeScript
- **Local:** porta **3002** (dev.db SQLite) — VPS na porta 3000
- **Produção:** 🟢 **no ar** em `gestao.solcentral.com.br` (PM2 `gestao-buddha`, `/var/www/apps/gestao-buddha`)

## 🌐 Caminhos
- **Local:** http://localhost:3002 — `npm run dev`
- **VPS / Produção:** https://gestao.solcentral.com.br 🟢 no ar
  - PM2: `gestao-buddha` · pasta: `/var/www/apps/gestao-buddha` · porta interna 3000

## 🔌 Integrações
- **Belle** — relatórios e BI (caixa, receitas, parcerias TotalPass/Gympass, NPS)
- **Google Places API** — nota e total de avaliações das 7 unidades (atualização diária)
- **WordPress** — cruzamento de vouchers (Belle × site)
- **Central de Atendimento** (`atendimento.solcentral.com.br`) — **consome** as tarefas do dia
  da Inteligência via `GET /api/tarefas-do-dia` (Bearer). É o app oficial de atendimento.
- ~~**LeadFlow**~~ (`flow.solcentral.com.br`) — app antigo, **sendo aposentado**. Não confundir
  com a Central. (Auth interna antiga `x-erp-key` em `/api/erp/*` fica como variante legada.)

---

## 🔗 API para a Central de Atendimento
- **`GET https://gestao.solcentral.com.br/api/tarefas-do-dia?unidade=<NOME>`** — fila do dia por
  unidade (nome, ex.: "Shopping Metrópole"). Auth: `Authorization: Bearer <CENTRAL_BEARER_TOKEN>`.
  Devolve `{ tarefas: [...] }`: id, titulo, cliente, telefone (com DDI), unidade, tipo, prioridade,
  status, criadaEm + extras (motivo, mensagemSugerida). **1 tarefa por telefone** (dedup na unidade).
- **`POST .../api/tarefas-do-dia/:id/concluir`** — marca feita (mesma auth).
- Contrato em `docs/INTEGRACAO-CENTRAL-ATENDIMENTO.md`. Token em `.env.local` (`CENTRAL_BEARER_TOKEN`).

---

## 🕑 Histórico (git: 14/06 → 19/08/2026)

**Ago/2026 (19) — Integração com a Central de Atendimento + estética**
- Endpoint `GET /api/tarefas-do-dia` (Bearer, filtro por nome de unidade) + `/concluir`
- **Dedup por telefone dentro da unidade** (casais/famílias no mesmo nº → 1 mensagem) + ordem de prioridade final
- Agendamento futuro robusto: janela 7→30 dias, match **por telefone** (+nome), **fail-safe** se o Belle cair
- Cadência semanal do cluster **Pacote Ativo** (demais 20 dias)
- **Paleta Buddha** aplicada no app inteiro; recepção mais amigável
- Fase 1/2 anteriores (`/api/erp/*`) viram variante interna; a Central usa o endpoint Bearer

**Jun/2026 — Nascimento do painel**
- 14/06 — Indicadores Vendas, NPS e Google Reviews com arquitetura anti-loop
- 14/06 — Gráfico de evolução diária do caixa + dados reais do Belle
- 14/06 — Tabela consolidada no **Radar Geral** com todos os indicadores
- 15/06 — Sistema híbrido de metas (dados históricos) + seletor de período (3 atalhos)
- 15/06 — Busca flexível de vouchers no cache

**Jun/2026 — Relatórios Belle & correções**
- Mapeamento completo dos relatórios Belle que alimentam o dashboard (`MAPEAMENTO-RELATORIOS-BELLE.md`)
- Correção do cálculo de **NPS** (fim da acumulação semestral; NPS Unidade = Profissionais + Atendimento)
- Seletor de **Semestre 1 / Semestre 2** no header
- Integração **Google Places API** (rating + avaliações automáticas)

**Jul/2026 — Metas reais + Inteligência**
- 26/07 — Metas reais 2026; vendas somando voucher + plano + produto
- 26/07 — Módulo **Inteligência**: modelos `ClienteScore` e `HistoricoContato`
- 26/07 — Recall + confirmação de envio (opção A)
- 26/07 — Vouchers: paginação do Belle + cruzamento com WordPress
- 26/07 — Dev movido para porta 3002; caminho do `dev.db` portável
- 26/07 — Fix Belle: leitura de totalizações aninhadas do BI (caixa/vendas zeradas)

**Ago/2026 — Inteligência → Produção (multi-tenant)**
- Fase 1 Segurança/Multi-tenant ✅ — auth JWT (`jose`) + bcrypt, cookie `bs_sess`, `guard.ts` (coração do multi-tenant), `proxy.ts`, seed de 7 unidades + DONA + recepção
- Documentado em `INTELIGENCIA-PRODUCAO.md` (última atualização 12/08)

---

## ✅ Status atual
- 🟢 **Dashboard/Radar em produção** e em uso.
- 🟢 **Multi-tenant pronto**: perfil **DONA** vê as 7 unidades; **RECEPÇÃO** só a própria.
- 🟡 **Módulo Inteligência**: arquitetado e construído, mas **em fase de teste — nenhum disparo real a cliente**. Deploy preparado, **aguardando "publico depois"** (Daniana).
- WhatsApp começa **semi-automático** (recepção clica → envia); massa é roadmap.

## ⏭️ Pendências / Próximos passos
1. Publicar o módulo Inteligência (script de deploy pronto, não executado).
2. Ligar disparos reais só após validação conjunta.
3. Evoluir do semi-automático para campanha em massa via LeadFlow (tag por unidade).

## 📁 Documentação no projeto
`STATUS-PROJETO.md` · `INTELIGENCIA-PRODUCAO.md` · `MAPEAMENTO-RELATORIOS-BELLE.md` ·
`MULTI-UNIDADES.md` · `RADAR-GERAL.md` · `VOUCHERS-GUIA-COMPLETO.md` ·
`TERAPEUTAS.md` · `REPLICAR-GOOGLE-REVIEWS.md` · `CONFIGURAR-GOOGLE-API.md`

## ▶️ Como rodar
```bash
cd C:/Users/MADISHAR/gestao-buddha-spa
npm install
npm run dev   # http://localhost:3002
```
