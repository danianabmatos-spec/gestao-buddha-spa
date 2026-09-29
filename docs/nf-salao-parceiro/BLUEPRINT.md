# BLUEPRINT — Controle Fiscal Lei do Salão Parceiro

> Contrato vivo do projeto (framework Da Planilha ao App). Alvo de deploy: **módulo dentro do ERP `gestao-buddha-spa`** (não app standalone). Desenvolvimento isolado no local; deploy na VPS só após validação. Acesso final: Financeiro + Felipe.

Planilha-fonte: `Downloads/Salão_Parceiro_-_Controle_-_SOL_CENTRAL_-_Agosto26 -.xlsx` (aba do mês = "AGOSTO 26"). NF real de referência: `Downloads/NFSe_59019042_1308.pdf`. Piloto: **Anália Franco / Sol Central**.

**Decisões (18/09/2026):**
- Começar do zero em **agosto/2026** — ignorar todo o histórico 2021→2025 da planilha. Agosto/26 é o **caso-teste de validação** (já emitido); a **primeira competência ao vivo é setembro/2026**.
- **RPS é sequenciado por unidade** (Perdizes tem a própria sequência, etc.). Próximo RPS da Anália = **1159** (campo editável por unidade; app nunca repete/pula).
- **Alíquota muda todo mês** → campo que a Daniana preenche no fechamento de cada mês (ISS + tributos aprox.). Sem valores futuros pré-cadastrados.
- **CNPJ das terapeutas vem sempre do app da Folha** (`folha-pagamento-buddha`, `model Terapeuta.cnpj`), buscado todo mês — não digitar à mão. (A folha ainda tem comissão e NFs por terapeuta = fontes futuras.)
- **Dias de crédito têm NF própria** da terapeuta (número separado da NF de comissão). Guardar os dois números.
- Terminar 100% a Anália; depois a Daniana envia as planilhas de agosto das outras 6 unidades.

---

## Fase 1 — Entrada ✅
- Arquivo: planilha Excel com histórico mensal desde 11/2021 (61 abas). Aba de trabalho do mês corrente = "AGOSTO 26".
- O que faz hoje: controla a emissão mensal das NFs da Lei do Salão Parceiro — cruza as NFs que as terapeutas (MEI) emitiram com a NF que o salão precisa emitir por terapeuta, calculando o valor de cada uma e mantendo o sequenciamento de RPS.

## Fase 2 — Processo ✅
**Abas relevantes:** "AGOSTO 26" (trabalho), "NFS" (notas avulsas emitidas a clientes), "Faturamento" (caixa do mês), "Reembolso" (extrato bancário JG Partners), "Auditoria terapeutas".

**Entidades:**
- **Competência do mês** (por unidade): base de emissão + alíquotas.
- **Terapeuta parceira (MEI)**: nome + CNPJ + valor da NF dela (comissão + dias de crédito).
- **NF do salão por terapeuta**: valor, % contribuição, base de cálculo, RPS, nº NF, discriminação.
- **Nota avulsa**: NF emitida no dia a cliente que pediu (abate da base).

**Fluxo:** (entra) faturamento caixa + reembolsos + NFs das terapeutas → (calcula) base a emitir → rateio por % de contribuição → valor da NF de cada terapeuta + base de cálculo do ISS + RPS → (sai) 1 NF por terapeuta emitida na prefeitura.

## Fase 3 — Regras ✅ (fórmulas confirmadas contra a planilha e a NF real)

**Base a emitir** (aba AGOSTO 26, L17:M22):
```
Faturamento (caixa Belle) .......... 141.059,70   [auto do gestão]
Reembolso voucher (líq. banco) .....  68.355,61   [auto do gestão]
Gympass (líq. banco) ...............   2.702,59   [manual]
TotalPass (líq. banco) .............   9.108,00   [manual]
(−) Notas avulsas já emitidas ......   4.391,00   [manual, aba NFS]
= VALOR BASE PARA EMISSÃO .......... 216.834,90
```
Fórmula: `Base = Faturamento + Reembolso + Gympass + TotalPass − NotasAvulsas`.

**Por terapeuta:**
**Dias de crédito (coluna B/F):** a terapeuta pode emitir DUAS NFs — a de comissão (nº na coluna C, valor G) e a de dias de crédito (nº na coluna B, valor F). Ex.: Carla → NF nº25 (R$6.839, comissão) + NF nº24 (R$1.818,83, dias de crédito). O valor dela P = comissão + dias de crédito = 8.657,83. O app guarda os **dois números de NF** + os dois valores.

| Campo | Significado | Fórmula planilha |
|---|---|---|
| H / P | Valor da terapeuta = comissão (G) + dias de crédito (F) = a NF MEI dela | `P = H` |
| N | % de contribuição | `N = P ÷ ΣP` |
| M | **Valor da NF do salão** (= "Valor total recebido" na NFS-e) | `M = Base × N` |
| O | Base de cálculo do ISS (= "Valor total do serviço" na NFS-e) | `O = M − P` |
| Q | RPS (sequencial interno) | manual, contínuo por unidade |
| J | Nº da NF | preenchido após emitir na prefeitura |

**Validação (Adriana):** P=4.719 → N=8,048% → M=17.452,32 → O=12.733,32. Idêntico ao PDF. Totais: ΣM=216.834,90 · ΣP=58.630,83.

**Campos fiscais da NFS-e (Prefeitura SP):**
- Prestador: Sol Central, CNPJ 29.714.058/0001-89, IM 5.901.904-2. Tomador: NÃO INFORMADO.
- Código serviço (fixo todas): `06.02.01 - Esteticista, tratamento de pele, depilação e congêneres.` / código prefeitura SP `08516`.
- Alíquota = **parâmetro do mês por unidade** (perguntar antes de fechar). Ago/26 Anália: ISS 2,39% / tributos aprox. 3,67%.
- Discriminação (montada por terapeuta):
  ```
  Serviços de Massagem e Estética Realizados no mês de AGOSTO/2026

  Profissional Parceiro: {NOME} - CNPJ {CNPJ} - R$ {P}

  Código do serviço prestado: 06.02.01 - Esteticista, tratamento de pele, depilação e congêneres.

  Alíquota de ISS {ISS} % e Alíquota dos tributos aproximados será de {TRIB}%
  ```

**CNPJ das terapeutas:** buscado do app da Folha (`folha-pagamento-buddha/app-next`, `model Terapeuta` → `cnpj`, `cpf`, `nomeBelle`, `unidadeId`) todo mês. Os 11 CNPJs da Anália em ago/26 (referência/validação): Adriana Ferreira Alves 12.506.425/0001-56; Aparecida Ferreira Borges 61.723.919/0001-06; Carina Mayumi Kameya Shimada 31.580.805/0001-85; Carla Perez 59.610.585/0001-04; Cintia Regina de Souza Gonçalves 61.585.517/0001-84; Claudia Nakandakare 25.123.276/0001-98; Elizabeth Santana Oshima 48.648.242/0001-12; Elaine Cristina da Silva Pimenta 62.010.728/0001-51; Helena Emiko Hattori 24.890.152/0001-75; Lucilene de Moraes Nascimento 47.317.711/0001-58; Victoria Rodrigues de Oliveira 60.827.242/0001-85.

---

## Fase 4 — Usuários & Permissões ✅
- Acesso ao módulo: só **DONA** e **FINANCEIRO** (perfil `FINANCEIRO` já existe no gestão). **Felipe** = login `FINANCEIRO`.
- Ajuste no `src/proxy.ts`: hoje FINANCEIRO só escreve no Caixa; liberar escrita também nas rotas `/nf-salao` (e `/api/nf-salao`). RECEPCAO/COORDENACAO/TERAPEUTA não veem o módulo (dado fiscal sensível).

## Fase 5 — Automações ✅ (v1)
1. **Puxar base do gestão:** faturamento em caixa = mês da competência; reembolso voucher = **mês civil anterior à competência (regra fixa)**. Gympass/TotalPass e notas avulsas seguem manuais. O app **mostra o valor + mês de origem e deixa conferir/editar antes de congelar** (nada entra às cegas).
2. **Puxar o bloco das terapeutas da Folha** (`folha-pagamento-buddha`): nome, CNPJ, **valor da comissão (fechamento do mês)**, **dias de crédito**, e os **números das NFs** que elas emitiram. Fonte: `Fechamento` (unidade/mês) → `ComissaoTerapeuta` + `NotaFiscal` (numeroNf, valor, dataEmissao, chave; CNPJ via `Terapeuta`). Como `NotaFiscal` não é única por terapeuta, as 2 notas (comissão + dias de crédito) vêm como 2 registros. Só ficam manuais: **Gympass, TotalPass, notas avulsas, alíquota e o RPS**. Conexão via HTTP (`FOLHA_BASE_URL` + `x-integracao-key`, padrão de `src/lib/folha/`) — novo endpoint na Folha `/api/integracao/notas-terapeutas?unidade&ano&mes`.
3. **Trava de conferência (sem ponta solta):** só fecha se ΣM = base e ΣP = soma das NFs das terapeutas; bloqueia RPS repetido/fora de sequência.
- Ficam pra depois: alerta de fechamento + export do lote; emissão automática na prefeitura.

## Fase 6 — Interface ✅ (definido)
- Design system do próprio gestão (consistência com o ERP; sem tela solta). Telas:
  - **Competência do mês** (por unidade): base (com origem/edição), alíquotas do mês, status.
  - **Lista de terapeutas** do mês: valor terapeuta, %, valor NF, base cálculo, RPS, status.
  - **Detalhe da terapeuta:** bloco de discriminação pronto pra copiar + campos fiscais + registrar nº NF/código verificação após emitir.
  - **Fechamento/conferência** com as travas.

## Fase 7 — Banco & Deploy
- Models Prisma no gestão:
  - `NfSalaoMes` (unidadeId, ano, mês, status, alíquotaIss, alíquotaTributos, base congelada).
  - `NfSalaoBase` (faturamento, reembolsoVoucher, gympass, totalpass, notasAvulsas).
  - `NfSalaoTerapeuta` (nome, cnpjMei, comissao G, diasCredito F, valorTerapeuta P, pct N, valorNota M, baseCalculo O, rps Q, nfMeiComissaoNum C, nfMeiCreditoNum B, nfSalaoNum J, codVerificacao, discriminacao, status).
  - `RpsSequencia` (unidadeId, proximoRps) — trava por unidade.
- Conector isolado `EmissorNfse` (modo=manual agora, modo=prefeitura-sp depois).
- Sync de CNPJ (e futuramente comissão) a partir do `folha-pagamento-buddha`.
- Deploy = migration + link no menu + liberar perfil (Financeiro + Felipe).

## Progresso do build
- ✅ **F0** — 3 models criados no `dev.db` local via SQL aditivo (NÃO usar `prisma db push`: ele quer dropar `Perfil`/`PerfilPermissao`, que existem só no banco). Client regenerado. RPS da Anália (unidadeId 2) semeado em **1159**. Backup do db em `dev.db.bak-nfsalao-*`.
- ✅ **F1** — motor `src/lib/nf-salao/motor.ts` (puro) validado 1:1 contra AGOSTO 26 via `scripts/nf-salao/validar-agosto.ts` (Node 24). Base 216.834,90 e os 11 valores (M/O/P) batem ao centavo; discriminação idêntica à NF real.
  - ✅ **Arredondamento (decidido):** cada NF arredondada a 2 casas; **aceitar a tolerância** (sem ajuste de resíduo). Soma das notas pode variar 1–2 centavos da base — é como a emissão real acontece. `conferir()` usa tolerância.
- ✅ **F2** — persistência: `scripts/nf-salao/seed-agosto.ts` gera o payload via motor; competência ago/26 gravada no banco (NfSalaoMes id=1 + 11 NfSalaoTerapeuta, status FECHADO, RPS/NF reais). `conferir()` = trava ΣM≈base.
- ✅ **F3 (v1 leitura)** — camada `src/lib/nf-salao/dados.ts` + rota `GET /api/nf-salao/[ano]/[mes]` (gated DONA/FINANCEIRO) + página `src/app/nf-salao/page.tsx` (base c/ origem, KPIs, tabela por terapeuta, detalhe c/ discriminação copiável, banner de conferência) + layout. Registrado no catálogo de permissões (`nf-salao`, FINANCEIRO=EDITAR) e no menu (Sidebar, ícone Scale). **Verificado E2E no local:** login DONA → API devolve os 11 registros reais; página compila (200) e é gated (401 sem sessão). `scripts` excluído do tsconfig.
- ✅ **F3 (escrita/fechamento)** — `src/lib/nf-salao/escrita.ts` (abrirCompetencia, salvarBase+recomputar, add/edit/removerTerapeuta, emitirNota, fechar/reabrirMes) + `PATCH`/`POST` (acao) na rota. Página editável: abrir mês, editar base+alíquotas (recomputa rateio), add/editar/remover terapeuta, registrar emissão (atribui próximo RPS atômico + nº NF + verificação), fechar/reabrir. **Verificado E2E:** abrir set/26 → add 2 terapeutas → PATCH base (146.000, ΣM=146.000, difBase 0) → emitir (RPS 1159→próximo 1160) → fechar (PATCH bloqueado 400) → reabrir. Dados de teste limpos; banco = só ago/26 FECHADO, RPS Anália=1159.
- ✅ **Integração com a Folha** — endpoint na Folha `GET /api/integracao/notas-terapeutas?unidade&ano&mes` (auth `x-integracao-key` ou sessão DANIANA/FELIPE/RH/FINANCEIRO; casa unidade por nome normalizado; lê `Fechamento`→`ComissaoTerapeuta`+`NotaFiscal`+`Terapeuta.usuario`). Client `src/lib/folha/notas-terapeutas.ts` + ação `puxarDaFolha` em escrita.ts + botão "Puxar terapeutas da Folha" na tela. **Verificado E2E (2 apps no ar, Folha→PG de PROD):** puxou as 11 de ago/26, comissões batendo com a planilha, **preservou os dias de crédito manuais da Carla (1.818,83)**, e **corrigiu o CNPJ da Carla** (Folha autoritativo). Descobertas fiscais importantes: (a) **comissão (G) = ComissaoTerapeuta.comissaoBruta** (bruto, exato); (b) **"dias de crédito" NÃO existe na Folha** → segue manual no controle; (c) nº NF de comissão = `NotaFiscal.numeroNf` (validadas); (d) **CNPJ da Carla diverge**: planilha `59.610.585/0001-04` vs Folha `32.444.753/0001-82` — Folha é a fonte. Anália na Folha = `unidade-analia`. Requer `INTEGRACAO_KEY` igual nos 2 apps (local .env.local + VPS) e Folha no ar (3003).
- ⏭️ Próximo: botão "puxar base do gestão" (caixa+reembolso auto); as outras 6 unidades; emissão automática na prefeitura; semear permissão FINANCEIRO no banco (PerfilPermissao) p/ Felipe.

## Pendências abertas
1. ⚠️ Próximo RPS da Anália: a planilha de agosto já mostra o **1159 usado** (Cintia). Confirmar se o próximo livre é **1159** mesmo ou **1160** (não pode repetir). Campo será editável — a Daniana ajusta na 1ª emissão.
2. ✅ Alíquota = parâmetro do mês (campo editável no fechamento). Ago/26 = ISS 2,39% / tributos 3,67%.
