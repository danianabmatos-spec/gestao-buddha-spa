# BLUEPRINT — Conferência Mensal de Reembolso de Vouchers

> Módulo dentro do ERP `gestao-buddha-spa` (não é app standalone).
> Origem: planilha `Reembolso vouchers <mês> 2026.xlsx`.
> Método: skill `/planilha-ao-app` (7 fases com checkpoint).

---

## Fase 1 — Entrada ✅
- Arquivo modelo: `07 Reembolso vouchers Julho 2026.xlsx`
- Pasta: `OneDrive\...\Conciliação Vouchers online\Reembolso vouchers 2026\`
- Existe um arquivo por mês (01 Janeiro … 08 Agosto). Cada mês é uma **cópia** do anterior com os números reescritos na mão.
- **O que faz hoje:** todo mês a franqueada monta essa planilha para apurar, por unidade, **quanto a rede/franqueadora precisa reembolsar** (reembolso pago dia 10, referente ao mês anterior).

## Fase 2 — Processo (mapa da lógica)

### Abas
| Aba | Papel |
|-----|-------|
| `RESUMO <mês>` | **Saída**: cálculo do valor a reembolsar por unidade (7 unidades) |
| `Compras` | Compras de cada unidade na rede (abatimento) |
| `Cortesias <Unidade>` ×7 | Controle de permutas/cortesias por unidade, com acúmulo de crédito mensal |

### RESUMO — colunas por unidade
| Col | Nome | Origem | Regra |
|-----|------|--------|-------|
| C | **Vouchers** | entrada | valor base de vouchers online do mês |
| D | Acréscimo 7% ("Tabela 8") | **calculado** | `= C * 7%` |
| E | **Omnichannel** | entrada | valor omnichannel do mês |
| F | **Cortesias (*)** | da aba `Cortesias <Unidade>` | excedente de permuta a reembolsar (célula do mês) |
| G | **Abatimentos / Compras** | da aba `Compras` | `= -Compras[unidade]`; **Perdizes e SAF = ×80%** (já têm 20% de desconto) |
| H | Instituto | entrada | dedução (negativo) |
| I | Treinamento | entrada | dedução (negativo). **SAF e Perdizes NÃO descontam treinamento** (prêmio PEX) |
| J | Royalties e Mkt | entrada | dedução (negativo) |
| K | **Valor a ser reembolsado** | **calculado** | `= SUM(C:J)` |
| — | TOTAL (linha 13) | calculado | soma de todas as unidades |

### Unidades (linhas 6–12) = as 7 do ERP
Higienópolis · Anália Franco · Perdizes · Shop Anália Franco (SAF) · Shop Mooca · Tatuapé Gomes Cardim · Shop Metrópole

### Compras (aba)
Uma linha por unidade, colunas B:D = lançamentos de compra, `E/F = SUM`. Alimenta a coluna G do RESUMO.

### Cortesias <Unidade> (controle de permuta) — a parte mais rica
Cada unidade tem:
- `Valor Mensal Permutável` (ex. 1300) e `Limite Máximo de Créditos Acumuláveis` (ex. 3900)
- Linha do tempo mensal (uma coluna por mês)
- **Valor Inicial de Créditos no Mês** = `MIN(saldo mês anterior + mensal, limite)`
- **Valor Utilizado em Vouchers no Mês** = soma da lista de vouchers-cortesia usados naquele mês
- **Saldo Acumulado p/ mês seguinte** = `IF(créditos-usado>0, MIN(diferença, limite), 0)`
- **Valor a Ser Reembolsado pela Franqueadora** = `IF(usado > créditos, usado - créditos, 0)` ← é isso que vai pra coluna F do RESUMO
- Abaixo: **lista de cada voucher-cortesia usado** (código, serviço, valor), agrupada por mês.

> Layouts das abas Cortesias são **inconsistentes entre unidades** (célula do total varia: M11, DA14…). Bagunça típica que o app padroniza.

### Mapa de origem dos dados (respondido pela Daniana)
| Campo | Origem | Como o app trata |
|-------|--------|------------------|
| **Vouchers (C)** | **WordPress** | buscar automático (integração WP) |
| Acréscimo 7% (D) | calculado | `C * 7%` |
| **Omnichannel (E)** | **WordPress** | buscar automático (integração WP) |
| **Cortesias (F)** | **WordPress** (lista de permutas) | buscar automático + motor de crédito/acúmulo |
| **Compras (G)** | **manual** (por ora) | entrada manual; futuro: integrar outro sistema |
| ~~Instituto (H)~~ | **REMOVIDO** | não entra mais na planilha |
| Treinamento (I) | **manual** | entrada manual (SAF/Perdizes isentos — PEX) |
| **Royalties e Mkt (J)** | **calculado sobre o faturamento do mês** | ERP já tem o faturamento; falta a **alíquota %** |
| Valor a reembolsar (K) | calculado | `SUM(C..J)` |

### Decisões desta fase
- **WordPress é a fonte principal** (vouchers, omnichannel e lista de cortesias). Integração WP é o coração do "buscar agosto".
- **Instituto sai** do modelo.
- **Royalties/Mkt** deixam de ser digitados → passam a ser calculados sobre o faturamento (que o ERP já puxa do Belle). Falta definir a alíquota.
- **Compras** seguem manuais, com gancho pra integração futura.

## Fase 3 — Regras (TRAVADAS)

### Fórmula por unidade (mês de referência)
```
Vouchers (WP)  + Acréscimo 7% (=Vouchers*7%)  + Omnichannel (WP)
+ Cortesias (WP)  − Compras  − Treinamento  − Royalties/Mkt  = Valor a reembolsar
```
- **Instituto**: removido do modelo.
- **Perdizes e SAF**: Compras entram com **×80%**; **sem** desconto de Treinamento (prêmio PEX).
- **Royalties/Mkt = 8% do faturamento CAIXA** (6% royalties + 2% mkt) — **somente Higienópolis**; demais unidades pagam por outra via ⇒ J=0. Faturamento caixa o ERP já tem (Belle).

### Origem dos 3 dados de WordPress (buddhaspa.com.br/wp-admin)
Mesma página `admin.php?page=vouchers`, mudando filtro:
| Dado | Filtro | Total lido |
|---|---|---|
| **Vouchers (C)** | Utilização (`date_used_start/end`) do mês | card "Reembolso" |
| **Omnichannel (E)** | Venda (`date_sell_start/end`) + `is_omnichannel=on` | card "Reembolso" |
| **Cortesias (F)** | Utilização do mês, linhas com **Reembolso = R$0** | valor da coluna de valor (⚠ verificar: nome do produto vs última coluna) |

### INFRA JÁ EXISTENTE (reutilizar, não reconstruir)
- `src/lib/wordpress/scraper.ts` — Puppeteer login+fetch dos 3 tipos
- `src/lib/wordpress/vouchers.ts` — `parseVouchersHTML` / `parseVouchersCortesia`
- `src/lib/wordpress/client.ts` — REST (Application Password) + relay + URL builder
- `src/lib/wordpress/voucher-filters.ts` — separa códigos omnichannel (`1511779…`)
- `src/app/api/vouchers/sync/route.ts` — endpoint que recebe HTML e parseia
- `scripts/sync-vouchers-todas-unidades.js` — **1 login → 7 unidades** via `affiliation_id`
- Credenciais + Affiliation IDs das 7 unidades: memória `wordpress_affiliation_ids` (projeto pai)
- ERP em produção: `https://gestao.solcentral.com.br`

### Fase 4 — Usuários (preliminar)
Uso executivo (Daniana + gestão). Entra no menu **Visão Executiva** do ERP, ao lado de Inteligência/Radar. Perfil restrito.

### Fase 5 — Automações (a maioria já pronta)
- ✅ Buscar Vouchers/Omni/Cortesias do WP (existe)
- ➕ Motor de crédito de permuta (acúmulo mensal com teto) — portar da planilha
- ➕ Cálculo Royalties/Mkt via faturamento Belle (Higienópolis)
- ➕ Fechar RESUMO mensal + exportar
- 🔜 (futuro) Compras via integração; cron mensal

### DECISÃO DE BUSCA (validada ao vivo)
- **Login automático de servidor NÃO passa no Cloudflare** do buddhaspa.com.br (headless E headful travam em "Um momento…"; Puppeteer detectado). Confirmado 2026-09.
- **O Chrome real da Daniana passa** (tem clearance). WordPress = 1 sessão por domínio ⇒ **1 login por unidade** é inerente.
- **Escolha: RELAY na sessão real (grátis).** Bookmarklet/extension rodando na página WP admin, puxa os 3 relatórios do mês e faz POST pro ERP. Unidade auto-detectada pelo nome da conta (`#wp-admin-bar-my-account .display-name` = "Buddha Spa <Unidade>"). ERP acumula as 7 ao longo do mês.

## Fase 7 — Plano de Build (módulo no ERP)

### Modelo de dados (Prisma / SQLite)
- `ReembolsoMes(id, ano, mes, status[aberto|fechado], createdAt)` — @@unique([ano,mes])
- `ReembolsoUnidade(id, reembolsoMesId, unidadeId, vouchers, omnichannel, cortesiaUsada, cortesiaReembolso, creditoInicial, saldoAcumulado, compras, treinamento, royaltiesMkt, faturamentoCaixa, fetchedAt)` — colunas C..K por unidade
- `ReembolsoCortesia(id, reembolsoUnidadeId, codigo, nome, valor, dataUtilizacao)` — lista auditável
- `PermutaConfig(unidadeId, valorMensalPermutavel, limiteAcumulo)` — seed a partir das abas Cortesias (Higienópolis 1300/3900; extrair as demais)

### Regras no código (`src/lib/reembolso/motor.ts`)
- `acrescimo7 = vouchers*0.07`
- motor de permuta: `creditoInicial=MIN(saldoAnterior+mensal, limite)`; `cortesiaReembolso=MAX(cortesiaUsada-creditoInicial,0)`; `saldoAcumulado=MIN(MAX(creditoInicial-cortesiaUsada,0),limite)`
- `comprasEfetiva = (SAF|Perdizes)? compras*0.8 : compras`
- `treinamentoEfetivo = (SAF|Perdizes)? 0 : treinamento`
- `royaltiesMkt = (Higienópolis)? faturamentoCaixa*0.08 : 0` (faturamento do Belle)
- `total = vouchers+acrescimo7+omnichannel+cortesiaReembolso − comprasEfetiva − treinamentoEfetivo − royaltiesMkt`

### API (`src/app/api/reembolso/…`)
- `POST /pull` — recebe payload do bookmarklet (unidade, ano, mes, vouchers, omni, cortesias[]) → salva + roda motor
- `GET /[ano]/[mes]` — RESUMO do mês
- `PATCH /unidade/[id]` — Compras/Treinamento manuais
- `POST /[ano]/[mes]/royalties` — puxa faturamento caixa Belle (Higienópolis) e calcula

### UI (`src/app/reembolso/…`)
- Menu Visão Executiva. Seletor de mês. Grade 7 unidades × colunas (C..K) + TOTAL.
- Status por unidade (puxado/pendente + timestamp). Inputs de Compras/Treinamento. Botão "Copiar bookmarklet" + instruções.

### Reuso
Parsers/URLs de `src/lib/wordpress/*`; padrão de relay do `/api/vouchers/sync`; faturamento de `src/lib/belle/*`.
