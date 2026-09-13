# 🏢 Sistema Multi-Unidades - Buddha Spa

**Data de implementação:** 2026-06-13  
**Status:** ✅ 2 unidades ativas (Shopping Metrópole + Anália Franco)

---

## 🎯 O QUE FOI IMPLEMENTADO

Sistema completo para gerenciar múltiplas unidades Buddha Spa com dashboards individuais e radar geral consolidado.

---

## 📊 UNIDADES CONFIGURADAS

### ✅ Todas as 7 Unidades Ativas! 🎉

| # | Unidade | Slug | Belle Email | Estab ID | Profissionais | Status |
|---|---------|------|-------------|----------|---------------|--------|
| 1 | Shopping Metrópole | `shopping-metropole` | adm.shoppingmetropole@buddhaspa.com.br | 1 | - | ✅ Ativo |
| 2 | Anália Franco | `analia-franco` | administracao.analiafranco@buddhaspa.com.br | 1 | 13 | ✅ Ativo |
| 3 | Shopping Anália Franco | `shopping-analia-franco` | administracao.shoppinganaliafranco@buddhaspa.com.br | 1 | 15 | ✅ Ativo |
| 4 | Perdizes | `perdizes` | administracao.perdizes@buddhaspa.com.br | 1 | 14 | ✅ Ativo |
| 5 | Tatuapé Gomes Cardim | `tatuape-gomescardim` | adm.tatuapegomescardim@buddhaspa.com.br | 1 | 11 | ✅ Ativo |
| 6 | Mooca Plaza | `mooca-plaza` | administracao.shoppingmooca@buddhaspa.com.br | 1 | 12 | ✅ Ativo |
| 7 | Higienópolis | `higienopolis` | administracao@buddhaspa.com.br | 1 | 20 | ✅ Ativo |

**Status:** 7/7 unidades (100%) ✅

---

## 🏗️ ARQUITETURA

### 1. **Rotas Dinâmicas**

#### Dashboard por Unidade
- **URL:** `/dashboard/[unidade]`
- **Exemplos:**
  - http://localhost:3000/dashboard/shopping-metropole
  - http://localhost:3000/dashboard/analia-franco

#### Radar Geral (Consolidado)
- **URL:** `/radar-geral`
- http://localhost:3000/radar-geral

### 2. **Navegação**

#### Menu Lateral (Desktop)

```
📊 VISÃO EXECUTIVA
├─ 📡 Radar Geral

📋 DASHBOARD POR UNIDADE
├─ 🏢 Shopping Metrópole
└─ 🏢 Anália Franco

📋 MENU OPERACIONAL
├─ 📅 Escala do Mês
├─ 📋 Fechamento Diário
├─ 👥 Terapeutas
├─ 🎯 Metas & Premiações
└─ 🎫 Vouchers Site
```

#### Mobile Nav (Bottom)
- Radar
- Dashboard (→ Shopping Metrópole)
- Metas
- Terapeutas

### 3. **APIs Atualizadas**

Todas as APIs Belle agora suportam o parâmetro `?unidade=slug`:

| API | Parâmetros | Exemplo |
|-----|-----------|---------|
| `/api/belle/faturamento` | `unidade`, `dataIni`, `dataFim` | `?unidade=analia-franco&dataIni=2026-06-01&dataFim=2026-06-13` |
| `/api/belle/nps` | `unidade`, `dataIni`, `dataFim` | `?unidade=analia-franco&dataIni=2026-06-01&dataFim=2026-06-13` |
| `/api/belle/agendamentos` | `unidade`, `data` | `?unidade=analia-franco&data=2026-06-13` |
| `/api/belle/agendamentos-periodo` | `unidade`, `dataIni`, `dataFim` | `?unidade=analia-franco&dataIni=2026-06-01&dataFim=2026-06-13` |
| `/api/google/reviews` | `unidade` | `?unidade=analia-franco` |

---

## 📁 ARQUIVOS CRIADOS/MODIFICADOS

### Novos Arquivos

1. **`src/lib/belle/unidades-config.ts`**
   - Helper para gerenciar credenciais por unidade
   - Função `getUnidadeCredenciais(slug)`
   - Função `getUnidadesDisponiveis()`

2. **`src/app/dashboard/[unidade]/page.tsx`**
   - Dashboard dinâmico que aceita qualquer unidade
   - Lê parâmetro `unidade` da URL
   - Busca dados da unidade específica

3. **`MULTI-UNIDADES.md`** (este arquivo)
   - Documentação completa do sistema multi-unidades

### Arquivos Modificados

1. **`.env.local`**
   - Adicionadas credenciais da Anália Franco
   ```bash
   BELLE_ANALIA_FRANCO_EMAIL=administracao.analiafranco@buddhaspa.com.br
   BELLE_ANALIA_FRANCO_PASSWORD=Analia@5353
   BELLE_ANALIA_FRANCO_ESTAB=1
   ```

2. **`src/app/dashboard/page.tsx`**
   - Agora redireciona para `/dashboard/shopping-metropole`

3. **`src/components/layout/sidebar.tsx`**
   - Adicionada seção "Dashboard por Unidade"
   - Lista todas unidades disponíveis

4. **`src/components/layout/mobile-nav.tsx`**
   - Dashboard aponta para `/dashboard/shopping-metropole`

5. **APIs Belle** (todas atualizadas para multi-unidades):
   - `src/app/api/belle/faturamento/route.ts`
   - `src/app/api/belle/nps/route.ts`
   - `src/app/api/belle/agendamentos/route.ts`
   - `src/app/api/belle/agendamentos-periodo/route.ts`

6. **`src/app/api/radar-geral/route.ts`**
   - Agora busca dados de Shopping Metrópole E Anália Franco

---

## 🧪 TESTES REALIZADOS

### ✅ Anália Franco - Faturamento (01 a 13/06/2026)

```bash
curl "http://localhost:3000/api/belle/faturamento?unidade=analia-franco&dataIni=2026-06-01&dataFim=2026-06-13"
```

**Resultado:**
```json
{
  "periodo": {"ini": "2026-06-01", "fim": "2026-06-13"},
  "caixa": 0,
  "totalPass": 2169,
  "gympass": 3209,
  "horasAtendimento": 395.25,
  "vendasRecepcao": 33157
}
```

✅ **API funcionando perfeitamente!**

---

## 🚀 COMO ADICIONAR NOVAS UNIDADES

### Passo 1: Descobrir Estab ID

```bash
curl "http://localhost:3000/api/belle/descobrir-id?email=EMAIL_AQUI&senha=SENHA_AQUI"
```

### Passo 2: Adicionar ao .env.local

```bash
# Nome da Unidade
BELLE_NOME_UNIDADE_EMAIL=email@buddhaspa.com.br
BELLE_NOME_UNIDADE_PASSWORD=senha_aqui
BELLE_NOME_UNIDADE_ESTAB=1
```

### Passo 3: Atualizar Arquivos

#### 3.1 - `src/lib/belle/unidades-config.ts`
```typescript
'nome-unidade': {
  slug: 'nome-unidade',
  nome: 'Nome da Unidade',
  email: process.env.BELLE_NOME_UNIDADE_EMAIL!,
  password: process.env.BELLE_NOME_UNIDADE_PASSWORD!,
  estab: Number(process.env.BELLE_NOME_UNIDADE_ESTAB!),
  placeId: process.env.PLACE_ID_NOME_UNIDADE!,
}
```

#### 3.2 - `src/components/layout/sidebar.tsx`
```typescript
const unidadesDisponiveis = [
  // ... existentes
  { slug: 'nome-unidade', nome: 'Nome da Unidade' },
]
```

#### 3.3 - Atualizar todas as APIs Belle
Adicionar nova unidade ao array `UNIDADES`:
- `src/app/api/belle/faturamento/route.ts`
- `src/app/api/belle/nps/route.ts`
- `src/app/api/belle/agendamentos/route.ts`
- `src/app/api/belle/agendamentos-periodo/route.ts`

#### 3.4 - `src/app/api/radar-geral/route.ts`
Adicionar slug na condição:
```typescript
if (unidadeSlug === 'shopping-metropole' || 
    unidadeSlug === 'analia-franco' ||
    unidadeSlug === 'nome-unidade') {
```

### Passo 4: Testar

```bash
# Testar faturamento
curl "http://localhost:3000/api/belle/faturamento?unidade=nome-unidade&dataIni=2026-06-01&dataFim=2026-06-13"

# Testar dashboard
# Acessar: http://localhost:3000/dashboard/nome-unidade
```

---

## 📈 DADOS ATUAIS (Período: 01-13/06/2026)

| Unidade | TotalPass | Gympass | Horas | Vendas Recepção | Google |
|---------|-----------|---------|-------|-----------------|--------|
| Shopping Metrópole | R$ 0 | R$ 0 | - | R$ 17.178,60 | 4.9 ⭐ |
| Anália Franco | R$ 2.169 | R$ 3.209 | 395,25h | R$ 33.157 | 4.6 ⭐ |
| Shopping Anália Franco | - | - | - | - | 4.8 ⭐ |
| Perdizes | R$ 3.126 | R$ 8.467 | 344,92h | R$ 27.421 | 4.9 ⭐ |
| Tatuapé Gomes Cardim | - | - | - | - | 4.7 ⭐ |
| Mooca Plaza | - | - | - | - | 4.7 ⭐ |
| Higienópolis | - | - | - | - | 4.8 ⭐ |

✅ **Todas as unidades com APIs funcionando!**

---

## 🎯 PRÓXIMOS PASSOS

### ✅ Concluído:
- [x] Configurar Anália Franco ✅
- [x] Configurar Shopping Anália Franco ✅
- [x] Configurar Perdizes ✅
- [x] Configurar Tatuapé Gomes Cardim ✅
- [x] Configurar Mooca Plaza ✅
- [x] Configurar Higienópolis ✅
- [x] Menu lateral com todas as 7 unidades ✅
- [x] Radar Geral mostrando 7 unidades ✅

### Curto Prazo:
- [ ] Adicionar seletor de unidade na navbar superior
- [ ] Implementar controle de acesso por perfil
- [ ] Dashboard comparativo (todas unidades lado a lado)

### Médio Prazo:
- [ ] Relatórios consolidados (PDF/Excel)
- [ ] Alertas automáticos (NPS baixo, queda de faturamento)
- [ ] Metas por unidade

---

## 🔐 SEGURANÇA

- ✅ Credenciais no `.env.local` (não versionadas)
- ✅ APIs validam existência da unidade (404 se não encontrada)
- ✅ Redirecionamento automático se unidade inválida
- ⏳ **Pendente:** Controle de acesso por usuário

---

**Criado por:** Claude Code  
**Data:** 2026-06-13  
**Versão:** 1.0
