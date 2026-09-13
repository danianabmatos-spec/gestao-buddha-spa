# Documentação - Página de Terapeutas

## Visão Geral
A página de Terapeutas apresenta uma tabela com indicadores de performance dos profissionais, com dados acumulados por semestre e integração com o Belle Software.

## Estrutura de Arquivos

### 1. Backend - Integração com Belle

#### `src/lib/belle/relatorio-fidelizacao.ts`
**Função**: `getTerapeutasFidelizacao()`
- **Report ID**: 192 - [Buddha] Relatório de Fidelização
- **Endpoint**: `/BI/v1.0/report/build`
- **Dados extraídos**:
  - Profissional (índice 0)
  - Horas de Atendimento (índice 3)
  - % Serviços Clientes Fidelizados (índice 8)
- **Filtros aplicados**:
  - Exclui profissionais contendo "recepção", "recepcao" ou "administrador"
- **Interface**:
```typescript
export interface TerapeutaFidelizacao {
  profissional: string
  horasAtendimento: number
  percServicosFidelizados: number
  nps: number
}
```

#### `src/lib/belle/chart-nps.ts`
**Função**: `getNPSProfissionais()`
- **Chart ID**: 241234431 - Detalhamento NPS Profissional
- **Endpoint**: `/BI/v1.0/chart/build`
- **Dados extraídos**:
  - Profissional (campo `prof`)
  - % Total NPS (campo `pctTotal`)
- **Caminho dos dados**: `data.chart.struct.data.rows[]`
- **Interface**:
```typescript
export interface NPSProfissional {
  profissional: string
  percTotal: number
}
```

#### `src/app/api/belle/terapeutas/route.ts`
**API Route** que orquestra a busca de dados:
- Busca dados de fidelização e NPS em **paralelo** usando `Promise.all()`
- Mescla os dados por nome do profissional
- Retorna array unificado com os 3 indicadores
- **Variáveis de ambiente necessárias**:
  - `BELLE_METROPOLE_EMAIL`
  - `BELLE_METROPOLE_PASSWORD`
  - `BELLE_METROPOLE_ESTAB` (padrão: 1)

### 2. Frontend - Página de Visualização

#### `src/app/terapeutas/page.tsx`
Componente principal da página com as seguintes funcionalidades:

##### Seleção de Período e Acumulação Semestral
A página utiliza um **seletor de mês** (não de data completa) para facilitar a navegação.

**Interface**:
- Seletor de mês (input type="month")
- Texto dinâmico mostrando o período acumulado (ex: "Janeiro a Maio 2026")

Os indicadores são **cumulativos por semestre**:
- **1º semestre (janeiro a junho)**: Acumula de 01/01 até o último dia do mês selecionado
- **2º semestre (julho a dezembro)**: Acumula de 01/07 até o último dia do mês selecionado

**Exemplo de visualização**:
- Seleciona "Abril 2026" → Exibe "Janeiro a Abril 2026" → Busca dados de 01/01 a 30/04
- Seleciona "Junho 2026" → Exibe "Janeiro a Junho 2026" → Busca dados de 01/01 a 30/06 (semestre completo)
- Seleciona "Agosto 2026" → Exibe "Julho a Agosto 2026" → Busca dados de 01/07 a 31/08
- Seleciona "Dezembro 2026" → Exibe "Julho a Dezembro 2026" → Busca dados de 01/07 a 31/12 (semestre completo)

**Lógica de ajuste automático**:
```typescript
// Extrai ano e mês do seletor (formato: YYYY-MM)
const [ano, mes] = mesSelecionado.split('-').map(Number)

// Calcula o último dia do mês
const ultimoDia = new Date(ano, mes, 0).getDate()
const dataFim = `${ano}-${mes}-${ultimoDia}`

// Ajusta para início do semestre
const dataIniAjustada = mes <= 6
  ? `${ano}-01-01`  // 1º semestre
  : `${ano}-07-01`  // 2º semestre
```

##### Separação de Profissionais
- **Profissionais Regulares**: Todos exceto os que contêm "banho" no nome
- **Profissionais Banho de Imersão**: Apenas os que contêm "banho" no nome

##### Cálculos e Métricas

**Notas (Produtividade, Fidelização, NPS) - Escala de 10**:
- O profissional com maior valor = 10
- Demais calculados proporcionalmente: `(valor / valorMaximo) * 10`

**Código de Cores para as Notas**:
- **10**: Fundo verde `bg-[#425F1D]` (atingiu a meta)
- **8.0 a 9.9**: Texto verde `text-[#425F1D]` (ótimo)
- **6.0 a 7.9**: Texto dourado `text-[#D78B18]` (bom)
- **< 6.0**: Texto vermelho `text-[#7E0000]` (abaixo do esperado)

**Destaques**:
- Maiores valores de cada indicador: Fundo dourado `bg-[#D78B18]`
- Apenas profissionais regulares recebem destaques
- Banho de imersão: sem destaques, sem Notas (exibe "-")

##### Estrutura da Tabela

**Colunas**:
1. Profissional
2. Horas de Atendimento
3. Nota de Produtividade
4. % Serviços Clientes Fidelizados
5. Nota de Fidelização
6. NPS
7. Nota de NPS

**Linhas de Totalização**:
1. **SUBTOTAL TERAPEUTAS**: Soma/média dos profissionais regulares
2. **SUBTOTAL BANHO DE IMERSÃO**: Soma/média dos profissionais de banho
3. **TOTAL GERAL**: Soma/média de todos os profissionais

**Formato dos Subtotais**:
- Horas: Soma total com sufixo "h"
- % Serviços e NPS: Média com sufixo "% (média)"
- Notas (Produtividade, Fidelização, NPS): "-" (não aplicável)

### 3. Navegação

#### `src/components/layout/sidebar.tsx`
Menu lateral com os seguintes itens (em ordem):
1. Dashboard
2. Escala do Mês
3. Fechamento Diário
4. **Terapeutas** ← novo item
5. Metas & Premiações
6. Vouchers Site

**Itens removidos**: "Agenda do Dia" e "Performance"

#### `src/components/layout/mobile-nav.tsx`
Menu mobile com os itens:
1. Início
2. Metas
3. Fechamento
4. **Terapeutas** ← novo item

**Itens removidos**: "Agenda"

## Como Reproduzir para Outras Unidades

### Passo 1: Configurar Variáveis de Ambiente
Cada unidade precisa de seu próprio arquivo `.env.local`:

```env
BELLE_METROPOLE_EMAIL=email@unidade.com
BELLE_METROPOLE_PASSWORD=senha_belle
BELLE_METROPOLE_ESTAB=1
```

**IMPORTANTE**: Cada unidade tem seu próprio `ESTAB` (estabelecimento) no Belle.

### Passo 2: Copiar Arquivos
Todos os arquivos criados são **independentes de unidade** e podem ser copiados:

**Backend**:
- `src/lib/belle/relatorio-fidelizacao.ts`
- `src/lib/belle/chart-nps.ts`
- `src/app/api/belle/terapeutas/route.ts`

**Frontend**:
- `src/app/terapeutas/page.tsx`

**Navegação**:
- `src/components/layout/sidebar.tsx`
- `src/components/layout/mobile-nav.tsx`

### Passo 3: Verificar Dados
Após configurar, verificar se:
1. Login no Belle está funcionando
2. Report ID 192 existe e está acessível
3. Chart ID 241234431 existe e está acessível
4. Profissionais "Recepção" e "Administrador" estão sendo filtrados
5. Acumulação semestral está funcionando corretamente

## IDs Importantes do Belle

| Tipo | Nome | ID | Uso |
|------|------|----|----|
| Report | [Buddha] Relatório de Fidelização | 192 | Horas e % Fidelização |
| Report | Relatório de Análise de NPS | 21 | Dados de NPS (Dashboard) |
| Chart | Detalhamento NPS Profissional | 241234431 | NPS por profissional |

## Regras de Negócio

### Exclusões
Profissionais **excluídos automaticamente**:
- Contém "recepção" ou "recepcao"
- Contém "administrador"

### Semestres
- **1º semestre**: Janeiro a Junho (zera em julho)
- **2º semestre**: Julho a Dezembro (zera em janeiro)

### Categorização
- **Banho de Imersão**: Nome contém "banho"
- **Regular**: Todos os demais profissionais

### Metas
- Meta = Maior valor do período entre profissionais regulares
- Profissionais de banho de imersão não entram no cálculo de meta
- Escala de 0 a 10 (onde 10 = 100% da meta)

## Paleta de Cores Utilizada

| Cor | Hex | Uso |
|-----|-----|-----|
| Marsala | #7E0000 | Headers, totais, valores baixos |
| Dourado | #D78B18 | Destaques, valores médios |
| Areia | #DDC7A4 | Bordas, subtotais |
| Off White | #E4E5E2 | Background da página |
| Flora (Verde) | #425F1D | Valores máximos, metas atingidas |
| Terra | #392617 | Textos padrão |

## Próximos Passos Sugeridos

1. **Exportação**: Adicionar botão para exportar tabela em Excel/PDF
2. **Filtros Adicionais**: 
   - Filtro por profissional específico
   - Comparação entre semestres
3. **Gráficos**: Visualizações gráficas dos indicadores
4. **Histórico**: Mostrar evolução mensal dos indicadores
5. **Alertas**: Notificações para profissionais abaixo de 6.0 na meta

## Observações Técnicas

- **Performance**: Dados de fidelização e NPS são buscados em paralelo
- **Timeout**: API calls têm timeout de 90 segundos
- **Cache**: Considera implementar cache para evitar múltiplas chamadas ao Belle
- **Error Handling**: Erros são capturados e exibidos ao usuário
- **Loading States**: Indicador de carregamento durante fetch de dados
- **Responsividade**: Tabela com scroll horizontal em telas pequenas
- **Seletor de Mês**: Utiliza input type="month" nativo do navegador, que exibe os meses por extenso (Janeiro, Fevereiro, etc.)

## Dependências

- Next.js 16 com Turbopack
- TypeScript
- Tailwind CSS
- Belle Software API
- Variáveis de ambiente (.env.local)

## Indicador de NPS no Dashboard

### Implementação

**Arquivo Backend**: `src/lib/belle/relatorio-nps.ts`
- **Report ID**: 21 - Relatório de Análise de NPS
- **Endpoint**: `/BI/v1.0/report/build`

**API Route**: `src/app/api/belle/nps/route.ts`
- Busca dados do relatório e calcula NPS para cada tipo

**Componente**: `src/components/dashboard/nps-cards.tsx`
- Exibe 3 cards: NPS Profissionais, NPS Atendimento, NPS Unidade

### Estrutura de Dados

O relatório retorna:
- **Data**: Data da avaliação
- **Cliente**: Código e nome
- **Classificação**: Promotor / Neutro / Detrator
- **Tipo NPS**: Profissional / Atendimento / Venda
- **Nota**: 0-10
- **Profissional**: Nome do profissional
- **Serviços**: Serviços avaliados

### Cálculo do NPS

**Fórmula**: NPS = % Promotores - % Detratores

**Classificação**:
- **Promotores**: Notas 9-10
- **Neutros**: Notas 7-8 (não entram no cálculo)
- **Detratores**: Notas 0-6

**Exemplo**:
- 50 promotores (50%)
- 30 neutros (30%)
- 20 detratores (20%)
- **NPS = 50% - 20% = 30**

### Indicadores Exibidos

1. **NPS Profissionais**: Avaliações do tipo "Profissional"
2. **NPS Atendimento**: Avaliações do tipo "Atendimento"
3. **NPS Unidade**: Todas as avaliações (total)

Cada card mostra:
- Score NPS (número inteiro)
- Classificação (Excelente / Muito Bom / Bom / Precisa Melhorar)
- Quantidade e % de Promotores
- Quantidade e % de Neutros
- Quantidade e % de Detratores
- Total de respostas

### Código de Cores

| Score NPS | Cor | Classificação |
|-----------|-----|---------------|
| ≥ 75 | Verde (#425F1D) | Excelente |
| 50-74 | Dourado (#D78B18) | Muito Bom |
| 0-49 | Terra (#392617) | Bom |
| < 0 | Marsala (#7E0000) | Precisa Melhorar |

### Acumulação Semestral

Assim como os outros indicadores, o NPS utiliza acumulação semestral:
- **1º semestre**: Janeiro a Junho
- **2º semestre**: Julho a Dezembro

Quando o usuário seleciona um período, o sistema automaticamente ajusta a data inicial para o início do semestre.

---

**Última atualização**: 07/06/2026
**Versão**: 1.1
**Unidade Base**: Shopping Metrópole
