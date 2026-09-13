# 📋 INSTRUÇÕES - Sincronizar Vouchers de Junho

## 🎯 Objetivo
Sincronizar TODOS os vouchers de junho (01/06 a 30/06) do WordPress para o sistema.

---

## ⚠️ PRÉ-REQUISITOS

1. ✅ Servidor local rodando: `npm run dev` (porta 3000)
2. ✅ Navegador: Google Chrome
3. ✅ Acesso ao WordPress: buddhaspa.com.br/wp-admin

---

## 📝 PASSO A PASSO

### **1. Acesse o WordPress**
Abra no Chrome:
```
https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers
```

Faça login com suas credenciais do WordPress.

---

### **2. Abra o Console do Chrome**
- Pressione **F12** (ou Ctrl+Shift+I)
- Clique na aba **Console**

---

### **3. Abra o Script**
No VS Code ou editor de texto, abra:
```
scripts/sync-junho-completo.js
```

---

### **4. Copie TODO o Script**
- Selecione **TODO** o conteúdo do arquivo (Ctrl+A)
- Copie (Ctrl+C)

---

### **5. Cole no Console**
- Volte para o Chrome (Console aberto)
- Cole o script (Ctrl+V)
- Pressione **Enter**

---

### **6. Aguarde a Sincronização**
O script vai mostrar o progresso:

```
═══════════════════════════════════════════════════════
🚀 SINCRONIZANDO JUNHO COMPLETO - Shopping Metrópole
═══════════════════════════════════════════════════════

📦 Processando: SITE (E-commerce)
──────────────────────────────────────────────────────
   Buscando dados do WordPress...
   ✓ HTML baixado: 45.2 KB
   Enviando para API local...
   ✅ SUCESSO!
      Total de vouchers: 31
      Valor total: R$ 9.629,00
      Validação Automática: 24
      Validação Manual: 7

📦 Processando: OMNICHANNEL
──────────────────────────────────────────────────────
   ...

📦 Processando: CORTESIA
──────────────────────────────────────────────────────
   ...

═══════════════════════════════════════════════════════
✅ SINCRONIZAÇÃO CONCLUÍDA!
═══════════════════════════════════════════════════════

📊 RESUMO GERAL:
   Total de vouchers: 45
   Valor total: R$ 12.500,00

🌐 Acesse a tabela:
   http://localhost:3000/dashboard/shopping-metropole/vouchers

💡 Atualize a página com Ctrl+F5
```

---

### **7. Verifique os Resultados**
Acesse:
```
http://localhost:3000/dashboard/shopping-metropole/vouchers
```

Você verá:
- ✅ Vouchers e-commerce utilizados no Belle
- 🤖 Validação Automática (sistema validou)
- 👤 Validação Manual (recepção digitou no WordPress)
- 💰 Valor total de reembolso

---

## 🔧 TROUBLESHOOTING

### ❌ "Erro HTTP 403/401 - Verifique se está logado"
**Solução:** Você não está logado no WordPress. Faça login e tente novamente.

### ❌ "Você não está logado no WordPress!"
**Solução:** O script detectou que não há sessão ativa. Faça login primeiro.

### ❌ "fetch failed" ou "network error"
**Solução:** O servidor local não está rodando. Execute `npm run dev`.

### ❌ "Erro na API: ..."
**Solução:** Verifique os logs do servidor Next.js no terminal.

---

## 📊 DADOS SINCRONIZADOS

O script sincroniza **3 tipos de vouchers**:

1. **SITE (E-commerce)**
   - Vouchers vendidos no site buddhaspa.com.br
   - Filtro: Data de utilização (date_used)
   - Com validação Belle (Automático vs Manual)

2. **OMNICHANNEL**
   - Vouchers do sistema omnichannel próprio
   - Filtro: Data de venda + flag omnichannel
   - Com validação Belle

3. **CORTESIA**
   - Vouchers gratuitos (valorReembolso = 0)
   - Sem validação Belle (não gera reembolso)

---

## ✅ RESULTADO ESPERADO

Após executar o script, o cache local (`cache/vouchers.json`) terá:
- Todos os vouchers de junho de cada tipo
- Status de validação (Automático/Manual)
- Valores corretos de reembolso
- Dados sincronizados com Belle Report 2422

---

## 🆘 PRECISA DE AJUDA?

Se algo der errado:
1. Verifique os logs no Console do Chrome
2. Verifique os logs do servidor Next.js (terminal)
3. Tire um print do erro e me envie
