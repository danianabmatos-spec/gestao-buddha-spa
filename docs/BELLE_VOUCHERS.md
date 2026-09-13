# Belle Report 2422 - Relatório de Uso de Vouchers

## 🎯 Resumo Rápido

**Status:** ✅ Funcionando perfeitamente  
**Testado em:** Shopping Metrópole (15/06/2026)  
**Resultado:** 57 vouchers (01-15/06) - Exato igual ao Excel manual

---

## 🚀 Como Usar

### Endpoint de API

```bash
GET /api/belle/vouchers-usados?unidade=SLUG&dataIni=YYYY-MM-DD&dataFim=YYYY-MM-DD
```

**Exemplo:**
```bash
GET /api/belle/vouchers-usados?unidade=shopping-metropole&dataIni=2026-06-01&dataFim=2026-06-15
```

**Slugs válidos:**
- `shopping-metropole`
- `analia-franco`
- `shopping-analia-franco`
- `perdizes`
- `tatuape-gomescardim`
- `mooca-plaza`
- `higienopolis`

---

## 🔑 Pontos Críticos

### 1. Paginação OBRIGATÓRIA
```typescript
// ✅ CORRETO: offsetRecords
payload.offsetRecords = 65

// ❌ ERRADO: offset
payload.offset = 65
```

### 2. Payload Exato
```typescript
{
  reportId: 2422,
  estab: '1',  // ← SEMPRE "1"
  filters: [
    { id: '121101', value: 'commerce' },  // ← OBRIGATÓRIO
    // ... outros filtros
  ],
  ignoreRecords: false,
  offsetRecords: 65  // ← Apenas se página 2+
}
```

### 3. Filtro de Códigos
Remove códigos que começam com `1511779` (não são vouchers e-commerce válidos)

---

## 📊 Fluxo de Dados

```
1. Busca página 1 (offsetRecords=0)
   ↓
2. Verifica record_count vs data.length
   ↓
3. Se há mais: busca página 2 (offsetRecords=65)
   ↓
4. Concatena todos os registros
   ↓
5. Remove códigos 1511779
   ↓
6. Retorna vouchers válidos
```

---

## 📁 Arquivos Principais

```
src/lib/belle/relatorio-vouchers.ts         ← Lógica + paginação
src/lib/belle/unidades-config.ts            ← Credenciais
src/app/api/belle/vouchers-usados/route.ts  ← Endpoint
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| Retorna menos que Excel | Verificar paginação (offsetRecords) |
| Retorna 0 vouchers | Verificar credenciais em .env.local |
| Códigos 1511779 aparecem | Verificar filtro está sendo aplicado |

---

## 📝 Para Mais Detalhes

Ver memória completa em:  
`~/.claude/projects/C--Users-MADISHAR/memory/belle_vouchers_paginacao.md`
