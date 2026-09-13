# Integração: Inteligência de Clientes (ERP) ↔ Central de Atendimento

**Objetivo:** a recepção trabalha as tarefas do dia **dentro da Central**; as mensagens
saem **do número da Central** (histórico único). O ERP é o **cérebro** (quem contatar,
por quê, prioridade, teto, mensagem sugerida); a Central são as **mãos + memória**.

- **Fila:** por unidade (a Central pede a fila da unidade que a atendente está trabalhando).
- **Envio:** número centralizado (hoje `atual` não-oficial; futuro: `atual` + `oficial`).
- **Auth serviço-a-serviço:** header `x-erp-key: <ERP_INTEGRATION_KEY>` (a mesma chave que já é
  compartilhada entre os dois apps). Endpoints do ERP ficam fora do login (`/api/erp/*`),
  então validam a chave internamente (fail-closed: sem chave configurada = 401).
- **Base URL do ERP (produção):** `https://gestao.solcentral.com.br`

> **Central oficial:** `https://atendimento.solcentral.com.br` (app separado, `/opt/central-atendimento`).
> Ela **consome** a API abaixo; o ERP **não** mexe no código/deploy dela.
> (O app `flow.solcentral.com.br`/LeadFlow é outro, sendo aposentado — ignorar.)

---

## ⭐ Endpoint em produção (o que a Central consome hoje)

Autenticação por **Bearer token** (segredo compartilhado, em `CENTRAL_BEARER_TOKEN`).
`unidade` é o **NOME** da unidade (não o slug). Chamada servidor-a-servidor (sem CORS).

### `GET https://gestao.solcentral.com.br/api/tarefas-do-dia?unidade={NOME}`
Header: `Authorization: Bearer <CENTRAL_BEARER_TOKEN>` (401 se não bater).
- `unidade` = nome da loja, ex.: `Perdizes`, `Shopping Metrópole` (acentos/caixa tolerados). Vazio = todas.
- Resposta: `{ "tarefas": [ ... ] }`, ordenada por prioridade, limite 1000.

```jsonc
{ "tarefas": [ {
  "id": "7270",                         // = clienteScoreId (usar no /concluir)
  "titulo": "Renovar pacote que está a vencer",
  "cliente": "Ana Carolina Freitas",
  "telefone": "5511960574453",          // já com DDI 55
  "unidade": "Perdizes",
  "tipo": "reativacao | follow-up | totalpass",
  "prioridade": "alta | normal | baixa",
  "status": "pendente",
  "criadaEm": "2026-08-20T00:54:21Z",
  "motivo": "PACOTE_A_VENCER",          // extra (bônus)
  "mensagemSugerida": "Olá Ana! ..."    // extra: mensagem pronta
} ] }
```

### `POST https://gestao.solcentral.com.br/api/tarefas-do-dia/{id}/concluir`
Header: `Authorization: Bearer <CENTRAL_BEARER_TOKEN>`. Marca a tarefa como feita:
grava `HistoricoContato` + `ultimoContato` (tira o cliente da fila). Idempotente por dia.
→ `{ "ok": true }` · `400` id inválido · `404` cliente não existe.

**TotalPass incluído:** o mesmo endpoint já traz os clientes **TotalPass** (2 sessões/mês) com
`tipo: "totalpass"` e `id` prefixado `tp-` (ex.: `"tp-27"`). O `/concluir` reconhece o `tp-` e
registra na base TotalPass. Para filtrar/agrupar na Central, use o campo `tipo`. Todas as
tarefas TotalPass são garantidas na resposta (o teto de 1000 corta só a fila de reativação).
**Respeita agendamento futuro:** cliente TotalPass que já tem horário marcado NÃO entra na fila
(mesma trava do pacote/frequência).

Código: `src/app/api/tarefas-do-dia/route.ts` e `.../[id]/concluir/route.ts`.

---

## 🗄️ Variante interna anterior (`/api/erp/*`, auth `x-erp-key`)

> Desenho inicial (a Central puxava com `x-erp-key` e slug). **Superado** pelo endpoint
> Bearer acima para o consumo da Central; mantido por referência / uso interno.

## ✅ Fase 1 — LEITURA da fila (implementado)

### `GET /api/erp/tarefas?unidade={slug}`
Header: `x-erp-key`. Devolve a fila **acionável** do dia (já exclui quem tem agendamento
futuro e quem foi contatado nos últimos ~20 dias; só quem tem telefone), ordenada por
prioridade, com a mensagem pronta.

Slugs de unidade: `shopping-metropole`, `analia-franco`, `shopping-analia-franco`,
`perdizes`, `tatuape-gomescardim`, `mooca-plaza`, `higienopolis`.

Exemplo:
```bash
curl -H "x-erp-key: $ERP_INTEGRATION_KEY" \
  "https://gestao.solcentral.com.br/api/erp/tarefas?unidade=shopping-metropole"
```

Resposta:
```jsonc
{
  "unidade": "shopping-metropole",
  "geradoEm": "2026-08-16T13:40:00.000Z",
  "teto": { "cap": 20, "enviadasHoje": 0, "restante": 20, "diasAtivos": 0, "fimDeSemana": true },
  "total": 42,
  "tarefas": [
    {
      "clienteScoreId": 1047,          // id estável — usar no callback da Fase 2
      "nome": "Thiago Trevisan Lino Alves",
      "telefone": "11957974017",       // sem +55; a Central prefixa conforme o canal
      "motivo": "PACOTE_A_VENCER",     // cluster (chave)
      "motivoLabel": "Pacote a vencer",// rótulo humano
      "statusPacote": "A_VENCER",
      "statusFrequencia": "EM_RISCO",
      "nomePlano": "Plano Personalizado",
      "sessoesRestantes": 9,
      "diasParaVencer": 15,
      "diasSemSessao": 77,
      "prioridade": 1,                 // menor = mais urgente
      "mensagemSugerida": "Olá Thiago! Seu pacote vence em 15 dias ..."  // editável pela atendente
    }
  ]
}
```

Erros: `401` (chave ausente/errada) · `400` (unidade inválida ou não informada).

**Observação sobre o teto:** hoje o teto vem **por unidade** (regra anti-ban atual). Como o
envio será por **número centralizado**, na Fase 2 a contagem/limite passa a ser **por canal
(número)** e quem impõe é a Central (dona do número). Por ora use `teto.restante` como guia.

---

## ✅ Fase 2 — ENVIO pela Central + callback (implementado, em produção)

Fluxo: atendente clica **Enviar** na Central → Central envia pelo próprio número
(`whatsapp.sendMessage(to, message)`, whatsapp-web.js) → Central confirma ao ERP.
Todos com header `x-erp-key`. A tarefa some da fila (`GET /api/erp/tarefas`) enquanto
estiver reservada por outra atendente.

### `POST /api/erp/tarefas/reservar`  *(trava de concorrência — 2 atendentes, mesma fila)*
```jsonc
{ "clienteScoreId": 1047, "atendente": "Ana" }
// 200 → { "ok": true, "reservadoAte": "2026-08-16T19:13:14Z" }  (TTL 10min; libera sozinho)
// 409 → { "error": "já reservado por outra atendente", "reservadoPor": "Bia" }
```

### `POST /api/erp/tarefas/concluir`  *(fecha o loop — grava histórico + teto)*
```jsonc
{
  "clienteScoreId": 1047,
  "unidade": "shopping-metropole",      // opcional; se vier, precisa bater com o cliente
  "textoEnviado": "Olá Thiago! ...",    // OBRIGATÓRIO — comprova o envio
  "canal": "atual",                      // "atual" | "oficial"
  "atendente": "Ana",
  "enviadoEm": "2026-08-16T13:41:00Z",   // opcional; default = agora
  "idempotencyKey": "central-msg-99321"  // opcional
}
// 200 → { "ok": true }                       (gravou HistoricoContato + ultimoContato)
// 200 → { "ok": true, "jaRegistrado": true } (idempotente: já registrado hoje p/ este cliente)
// 400 (clienteScoreId inválido ou textoEnviado vazio) · 404 (cliente não existe)
```
O ERP grava `HistoricoContato` (o teto do dia incrementa via `criadoEm`), põe
`ultimoContato` e tira o cliente da fila. Substitui o passo atual de "abrir wa.me e
confirmar 'Enviou? Sim'". **Idempotente por (cliente, dia)** — retry não duplica nem
infla o teto. **Não** aplica a trava anti-mensagem-errada (a mensagem já saiu) e **não**
espelha de volta no LeadFlow (a Central já é a dona do histórico).

> **Onde fica o texto:** o conteúdo da conversa vive na **Central** (dona do histórico).
> O ERP registra o *evento* + motivo + snapshot para os Resultados, não o texto.

### `POST /api/erp/tarefas/devolver`  *(atendente desistiu — volta pra fila)*
```jsonc
{ "clienteScoreId": 1047 }
// 200 → { "ok": true }
```

## 🔮 Fase 3 — enriquecimentos
- Resposta do cliente → sinal de score no ERP ("respondeu").
- Deep-link cruzado (abrir conversa na Central ↔ ver ficha na Inteligência).
- Anotar na conversa quando o Belle detecta conversão (nova sessão / renovação).

## Guardrails que não podem se perder
- **Teto anti-ban por número** (Fase 2) — conservador; horário comercial; pacing.
- **Opt-out** respeitado (cliente que pede parar sai da fila).
- **Texto real enviado** guardado (vem no `concluir`), não só a sugestão.
