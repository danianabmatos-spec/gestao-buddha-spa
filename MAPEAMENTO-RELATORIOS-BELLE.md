# Mapeamento de Relatórios Belle → Dashboard

**Unidade:** Shopping Metrópole (AELIA SAUDE E BEM ESTAR LTDA)  
**Data de criação:** 2026-06-07  
**Objetivo:** Documentar quais relatórios do Belle alimentam cada campo do Dashboard

---

## 📋 Relatórios Necessários

### 1. Total Recebido em Caixa

**Relatório Belle:** `[Buddha] Resumo - Receitas do Período`

**Campo no Relatório:** `Total Recebido em Caixa`

**Filtros:**
- Período Entre: `[data inicial]`
- Até: `[data final]`

**Valores Coletados (Shopping Metrópole):**
- **Fevereiro/2026** (01/02 - 28/02): R$ 37.886,10
- **Março/2026** (01/03 - 31/03): R$ 77.827,05
- **Abril/2026** (01/04 - 30/04): R$ 97.543,23
- **Maio/2026** (01/05 - 31/05): R$ 121.368,65
- **Junho/2026** (01/06 - 07/06): R$ 17.178,60

**Exemplo de Acesso:**
1. Acessar: BI (Business Intelligence) > Relatórios
2. Selecionar: `[Buddha] Resumo - Receitas do Período`
3. Clicar no ícone de filtro (funil) no topo direito
4. Configurar período desejado
5. Clicar em "Aplicar Filtros"
6. Buscar o valor em: `Total Recebido em Caixa`

---

### 2. Parceria Comercial - TotalPass

**Relatório Belle:** `[Buddha] Resumo - Parcerias Comerciais`

**Campo no Relatório:** `Parceria Comercial - TotalPass`

**Filtros:**
- Período Entre: `[data inicial]`
- Até: `[data final]`

**Valores Coletados (Shopping Metrópole):**
- **Fevereiro/2026** (01/02 - 28/02): R$ 1.102,00
- **Março/2026** (01/03 - 31/03): R$ 3.310,00
- **Abril/2026** (01/04 - 30/04): R$ 5.643,00
- **Maio/2026** (01/05 - 31/05): R$ 11.652,00
- **Junho/2026** (01/06 - 07/06): R$ 1.869,00

**Exemplo de Acesso:**
1. Acessar: BI (Business Intelligence) > Relatórios
2. Selecionar: `[Buddha] Resumo - Parcerias Comerciais`
3. Clicar no ícone de filtro (funil) no topo direito
4. Configurar período desejado
5. Clicar em "Aplicar Filtros"
6. Buscar o valor em: `Parceria Comercial - TotalPass`

---

### 3. Parceria Comercial - Gympass

**Relatório Belle:** `[Buddha] Resumo - Parcerias Comerciais`

**Campo no Relatório:** `Parceria Comercial - Gympass`

**Filtros:**
- Período Entre: `[data inicial]`
- Até: `[data final]`

**Valores Coletados (Shopping Metrópole):**
- **Fevereiro/2026** (01/02 - 28/02): R$ 280,00
- **Março/2026** (01/03 - 31/03): R$ 840,00
- **Abril/2026** (01/04 - 30/04): R$ 1.820,00
- **Maio/2026** (01/05 - 31/05): R$ 4.008,00
- **Junho/2026** (01/06 - 07/06): R$ 280,00

**Exemplo de Acesso:**
1. Acessar: BI (Business Intelligence) > Relatórios
2. Selecionar: `[Buddha] Resumo - Parcerias Comerciais`
3. Clicar no ícone de filtro (funil) no topo direito
4. Configurar período desejado
5. Clicar em "Aplicar Filtros"
6. Buscar o valor em: `Parceria Comercial - Gympass`

---

### 4. Indicadores de Satisfação (NPS)

**Relatório Belle:** `Relatório de Análise de NPS` (Report ID: 21)

**Campos no Dashboard:**
- **NPS Profissionais** - Avaliações sobre os terapeutas
- **NPS Atendimento** - Avaliações sobre a experiência de atendimento
- **NPS Unidade** - Total geral (soma de Profissionais + Atendimento)

**Filtros:**
- Período Entre: `[data inicial]` (YYYY-MM-DD)
- Até: `[data final]` (YYYY-MM-DD)
- Filtro ID: `338306625`

**Estrutura do Relatório:**
- [0] Data
- [1] Cliente
- [2] Classificação (Promotor, Neutro/Passivo, Detrator)
- [3] Tipo NPS (Profissional, Atendimento, Venda, etc.)
- [4] Nota
- [5] Descrição
- [6] ID Atendimento
- [7] Profissional
- [8] Serviços

**Cálculo NPS:**
```
NPS = % Promotores - % Detratores

Exemplo:
- 60% Promotores
- 30% Neutros
- 10% Detratores
→ NPS = 60 - 10 = 50
```

**Classificação:**
- **Promotores:** Notas 9-10
- **Neutros/Passivos:** Notas 7-8
- **Detratores:** Notas 0-6

**Exemplo de Acesso:**
1. Acessar: BI (Business Intelligence) > Relatórios
2. Selecionar: `Relatório de Análise de NPS`
3. Clicar no ícone de filtro (funil) no topo direito
4. Configurar período desejado
5. Clicar em "Aplicar Filtros"
6. Filtrar por tipo: "Profissional" ou "Atendimento"
7. Contar promotores, neutros e detratores
8. Aplicar fórmula: NPS = % Promotores - % Detratores

**Observações:**
- O período deve corresponder exatamente ao selecionado no dashboard (sem acumulação)
- NPS Unidade = soma apenas de registros tipo "Profissional" + "Atendimento"
- Outros tipos (ex: "Venda") são excluídos do cálculo da Unidade

---

## 🔐 Credenciais de Acesso

### Belle - Shopping Metrópole
```
URL: https://app.bellesoftware.com.br/
E-mail: adm.shoppingmetropole@buddhaspa.com.br
Senha: Metr@1056
Estabelecimento: 1 (AELIA SAUDE E BEM ESTAR LTDA)
```

---

## 📝 Observações Importantes

1. **Período de coleta:** Sempre usar o período completo do mês (dia 01 até último dia)
2. **Junho parcial:** Como estamos em 07/06/2026, junho vai de 01/06 até 07/06
3. **Formato de datas:** dd/mm/yyyy (exemplo: 01/02/2026)
4. **Timezone:** Horário de Brasília (UTC-3)
5. **Atualização:** Os dados devem ser atualizados mensalmente

---

## 🔄 Processo de Sincronização

### Frequência
- Mensal (após fechamento do mês anterior)
- Atualização parcial do mês corrente (semanal ou sob demanda)

### Passos
1. Fazer login no Belle
2. Acessar cada relatório listado acima
3. Aplicar filtros de período
4. Copiar os valores dos campos especificados
5. Atualizar o Dashboard com os novos valores

---

## 📊 Outros Relatórios Disponíveis no Belle

Relatórios Buddha disponíveis que podem ser úteis futuramente:

- `[Buddha] Consolidado de Receitas`
- `[Buddha] Consolidado de Atendimentos`
- `[Buddha] Resumo - Estatísticas de Receitas`
- `[Buddha] Resumo - Estatísticas de Atendimentos`
- `[Buddha] Resumo - Ticket Médio`
- `[Buddha] Resumo - 10 Principais Clientes`
- `[Buddha] Relatório de Voucher`
- `[Buddha] Relatório de Venda de Planos`
- `[Buddha] Relatório de Novos Clientes`
- `[Buddha] Parcerias Comerciais` (detalhado)
- `[Buddha] Taxa de Conversão em Pacotes`

---

## ✅ Próximos Passos

1. [x] ~~Completar coleta de dados de Parcerias Comerciais (TotalPass e Gympass)~~ ✅ **CONCLUÍDO**
2. [x] ~~Documentar e corrigir cálculo de NPS (Profissionais, Atendimento, Unidade)~~ ✅ **CONCLUÍDO**
3. [ ] Atualizar Dashboard com os valores corretos de fevereiro a junho
4. [ ] Documentar campos adicionais conforme necessidade
5. [ ] Criar script de automação para coleta via API Belle (se disponível)
6. [ ] Replicar processo para as demais 6 unidades Buddha Spa

---

## 📊 Resumo dos Dados Coletados

### Shopping Metrópole - Fevereiro a Junho 2026

| Mês | Recebido em Caixa | TotalPass | Gympass | Total Parcerias |
|-----|-------------------|-----------|---------|-----------------|
| **Fev** | R$ 37.886,10 | R$ 1.102,00 | R$ 280,00 | R$ 1.382,00 |
| **Mar** | R$ 77.827,05 | R$ 3.310,00 | R$ 840,00 | R$ 4.150,00 |
| **Abr** | R$ 97.543,23 | R$ 5.643,00 | R$ 1.820,00 | R$ 7.463,00 |
| **Mai** | R$ 121.368,65 | R$ 11.652,00 | R$ 4.008,00 | R$ 15.660,00 |
| **Jun** | R$ 17.178,60 | R$ 1.869,00 | R$ 280,00 | R$ 2.149,00 |
| **TOTAL** | **R$ 351.803,63** | **R$ 23.576,00** | **R$ 7.228,00** | **R$ 30.804,00** |

---

**Última atualização:** 2026-06-07  
**Responsável:** Sistema de Gestão Buddha Spa  
**Status:** ✅ Dados coletados e validados
