# 🔄 Guia de Replicação - Google Reviews para Outras Unidades

**Criado em:** 2026-06-13  
**Status Atual:** ✅ Shopping Metrópole funcionando  
**Próximo:** Replicar para as 6 unidades restantes

---

## ✅ O QUE JÁ ESTÁ PRONTO

### API Configurada
- ✅ Google Places API ativada
- ✅ API Key configurada
- ✅ Código implementado em `src/lib/google/places-api.ts`
- ✅ Endpoint `/api/google/reviews` funcionando
- ✅ Componente `GoogleReviewsCard` criado

### Place IDs Obtidos (Todas as 7 Unidades)

| Unidade | Place ID | Rating | Avaliações |
|---------|----------|--------|------------|
| Shopping Metrópole | `ChIJ8ara5DxDzpQR5hHvFUo5-kk` | 4.9 ⭐ | 71 |
| Anália Franco | `ChIJ-2_uQ4RezpQRin9JUKsYK9A` | 4.8 ⭐ | 1,253 |
| Shopping Anália Franco | `ChIJxbH2U0ddzpQRcDuupLgOSUM` | 4.8 ⭐ | 484 |
| Perdizes | `ChIJ-8SUCvVXzpQRyBzaFu_4Ozo` | 4.7 ⭐ | 511 |
| Tatuapé Gomes Cardim | `ChIJsweBvdRfzpQRiBGaRJB8To0` | 4.9 ⭐ | 188 |
| Mooca Plaza | `ChIJ5z7Qc59bzpQRKmioJQJr_NA` | 4.7 ⭐ | 551 |
| Higienópolis | `ChIJHd_RsSNYzpQReXgrWHDuoO4` | 4.7 ⭐ | 1,164 |

**Todos já estão no `.env.local`** ✅

---

## 🎯 OPÇÕES DE IMPLEMENTAÇÃO

### Opção 1: Dashboard Individual por Unidade (Atual)

**Como está agora:**
- Dashboard mostra apenas Shopping Metrópole
- URL: `http://localhost:3000/dashboard`

**Para adicionar outras unidades:**
1. Criar rotas separadas: `/dashboard/analia-franco`, `/dashboard/perdizes`, etc.
2. Cada rota busca dados da sua unidade específica

**Vantagens:**
- Simples de implementar
- Cada unidade tem seu próprio dashboard
- Dados não se misturam

**Desvantagens:**
- Precisa acessar URLs diferentes
- Não permite comparação entre unidades

---

### Opção 2: Dashboard com Seletor de Unidade (Recomendado)

**Como ficaria:**
- Dashboard único com dropdown para escolher a unidade
- URL: `http://localhost:3000/dashboard?unidade=analia-franco`
- Dados carregam dinamicamente conforme a unidade selecionada

**Vantagens:**
- Interface única e consistente
- Fácil de trocar entre unidades
- Melhor UX

**Desvantagens:**
- Requer modificar vários componentes
- Mais complexo de implementar

---

### Opção 3: Dashboard Consolidado (Futuro)

**Como ficaria:**
- Mostra todas as 7 unidades ao mesmo tempo
- Grid com cards lado a lado
- Comparação visual entre unidades

**Vantagens:**
- Visão geral de todas as unidades
- Identifica rapidamente unidades com problemas
- Perfeito para gestão

**Desvantagens:**
- Muitas requisições simultâneas
- Pode ficar lento
- Muito conteúdo na tela

---

## 🚀 IMPLEMENTAÇÃO RÁPIDA - OPÇÃO 2 (RECOMENDADO)

### Passo 1: Adicionar Seletor no Header

**Arquivo:** `src/components/layout/header.tsx`

Adicionar após a linha do nome da unidade (linha ~49):

```typescript
const UNIDADES = [
  { nome: 'Shopping Metrópole', slug: 'shopping-metropole' },
  { nome: 'Anália Franco', slug: 'analia-franco' },
  { nome: 'Shopping Anália Franco', slug: 'shopping-analia-franco' },
  { nome: 'Perdizes', slug: 'perdizes' },
  { nome: 'Tatuapé Gomes Cardim', slug: 'tatuape-gomescardim' },
  { nome: 'Mooca Plaza', slug: 'mooca-plaza' },
  { nome: 'Higienópolis', slug: 'higienopolis' }
]

// Adicionar prop
interface HeaderProps {
  // ... props existentes
  unidadeSlug: string
  onUnidadeChange: (slug: string) => void
}

// No JSX, adicionar dropdown
<select 
  value={unidadeSlug}
  onChange={(e) => onUnidadeChange(e.target.value)}
  className="text-xs font-semibold"
>
  {UNIDADES.map(u => (
    <option key={u.slug} value={u.slug}>{u.nome}</option>
  ))}
</select>
```

### Passo 2: Atualizar Dashboard Page

**Arquivo:** `src/app/dashboard/page.tsx`

```typescript
// Adicionar estado
const [unidadeSlug, setUnidadeSlug] = useState('shopping-metropole')

// Atualizar buscarGoogleReviews (linha ~117)
const buscarGoogleReviews = useCallback(async () => {
  setLoadingGoogle(true)
  try {
    const resp = await fetch(`/api/google/reviews?unidade=${unidadeSlug}`)
    // ... resto do código
  }
}, [unidadeSlug]) // Adicionar dependência

// Passar props para Header
<Header
  // ... props existentes
  unidadeSlug={unidadeSlug}
  onUnidadeChange={setUnidadeSlug}
/>
```

### Passo 3: Recarregar Dados ao Trocar Unidade

```typescript
// Adicionar useEffect
useEffect(() => {
  buscarGoogleReviews()
}, [unidadeSlug, buscarGoogleReviews])
```

### Passo 4: Testar

```bash
# Reiniciar servidor
npm run dev

# Acessar dashboard
# Selecionar diferentes unidades no dropdown
# Verificar se os dados carregam corretamente
```

---

## 🧪 TESTES DE VALIDAÇÃO

### Teste 1: API de Cada Unidade

Execute no terminal:

```bash
# Shopping Metrópole
curl -s http://localhost:3000/api/google/reviews?unidade=shopping-metropole | grep rating

# Anália Franco
curl -s http://localhost:3000/api/google/reviews?unidade=analia-franco | grep rating

# Shopping Anália Franco
curl -s http://localhost:3000/api/google/reviews?unidade=shopping-analia-franco | grep rating

# Perdizes
curl -s http://localhost:3000/api/google/reviews?unidade=perdizes | grep rating

# Tatuapé Gomes Cardim
curl -s http://localhost:3000/api/google/reviews?unidade=tatuape-gomescardim | grep rating

# Mooca Plaza
curl -s http://localhost:3000/api/google/reviews?unidade=mooca-plaza | grep rating

# Higienópolis
curl -s http://localhost:3000/api/google/reviews?unidade=higienopolis | grep rating
```

**Resultado esperado:** Cada comando deve retornar `"rating":4.X`

### Teste 2: Dashboard Visual

1. Acessar `http://localhost:3000/dashboard`
2. Verificar se o card "Reputação Online" aparece
3. Verificar se mostra:
   - Nota (ex: 4.9)
   - Total de avaliações (ex: 71 avaliações)
   - Barras de distribuição de estrelas
   - Link "Ver no Google"

### Teste 3: Performance

```bash
# Medir tempo de resposta de cada unidade
time curl -s http://localhost:3000/api/google/reviews?unidade=shopping-metropole > /dev/null
```

**Tempo esperado:** Menos de 2 segundos

---

## 📊 DADOS REAIS DAS 7 UNIDADES

### Shopping Metrópole
- Rating: **4.9** ⭐⭐⭐⭐⭐
- Total: **71 avaliações**
- Endereço: Pça. Samuel Sabatini, 200 - Centro, São Bernardo do Campo

### Anália Franco
- Rating: **4.8** ⭐⭐⭐⭐⭐
- Total: **1,253 avaliações** 🏆 (Maior número!)
- Endereço: R. Rosa das Neves, 53 - Vila Reg. Feijó, São Paulo

### Shopping Anália Franco
- Rating: **4.8** ⭐⭐⭐⭐⭐
- Total: **484 avaliações**
- Endereço: Av. Reg. Feijó, 1739 - Loja TL 87, São Paulo

### Perdizes
- Rating: **4.7** ⭐⭐⭐⭐☆
- Total: **511 avaliações**
- Endereço: R. Monte Alegre, 1144 - Perdizes, São Paulo

### Tatuapé Gomes Cardim
- Rating: **4.9** ⭐⭐⭐⭐⭐ 🏆 (Melhor rating!)
- Total: **188 avaliações**
- Endereço: R. Azevedo Soares, 2312 - Tatuapé, São Paulo

### Mooca Plaza
- Rating: **4.7** ⭐⭐⭐⭐☆
- Total: **551 avaliações**
- Endereço: Rua Capitão Pacheco e Chaves, 313 Lj 2010, São Paulo

### Higienópolis
- Rating: **4.7** ⭐⭐⭐⭐☆
- Total: **1,164 avaliações**
- Endereço: R. Eng. Edgar Egídio de Sousa, 510 - Higienópolis, São Paulo

---

## 🔧 PROBLEMAS COMUNS E SOLUÇÕES

### ❌ Erro 404: "Place ID is no longer valid"

**Causa:** Place ID inválido ou formato incorreto

**Solução:**
```bash
# 1. Buscar novo Place ID
node scripts/find-place-id.mjs

# 2. Copiar o Place ID correto
# 3. Atualizar .env.local
# 4. Reiniciar servidor
```

### ❌ Erro 500: "GOOGLE_PLACES_API_KEY não configurada"

**Causa:** API Key ausente no .env.local

**Solução:**
1. Abrir `.env.local`
2. Adicionar: `GOOGLE_PLACES_API_KEY=AIzaSyBbxwgnwuUVyIJC2Xzyy8x3ZwnJRxlPMNc`
3. Reiniciar servidor

### ❌ Dados não carregam (loading infinito)

**Causa:** Endpoint com erro ou timeout

**Solução:**
1. Abrir console do navegador (F12)
2. Verificar erros na aba Network
3. Testar endpoint direto: `curl http://localhost:3000/api/google/reviews?unidade=X`
4. Verificar logs do servidor Next.js

---

## 💰 CUSTOS E LIMITES

### Consumo Atual
- **1 unidade (Shopping Metrópole):** ~30 requisições/mês
- **7 unidades:** ~210 requisições/mês

### Limite Gratuito do Google
- **$200 de créditos** gratuitos por mês
- **1.000 requisições** gratuitas de Place Details
- Depois: $17 por 1.000 requisições

### Nossa Situação
- ✅ Totalmente dentro do plano gratuito
- ✅ Custo real: **$0,00/mês**
- ✅ Margem de segurança: 790 requisições livres

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Testar API de todas as 7 unidades
- [ ] Adicionar seletor de unidade no Header
- [ ] Atualizar dashboard para usar unidade dinâmica
- [ ] Testar troca entre unidades
- [ ] Verificar performance (< 2s por unidade)
- [ ] Documentar URL de cada unidade
- [ ] Criar atalhos de acesso rápido
- [ ] Testar em diferentes navegadores
- [ ] Validar dados com Google Maps real
- [ ] Treinar equipe de cada unidade

---

## 🎯 PRÓXIMOS PASSOS

1. **Imediato:** Testar API de todas as 7 unidades
2. **Esta semana:** Implementar seletor de unidade
3. **Este mês:** Dashboard consolidado (visão geral)
4. **Futuro:** Alertas automáticos se rating cair

---

**Status:** 1 de 7 unidades implementadas ✅  
**Próximo:** Implementar seletor de unidade para acessar todas as 7
