# 📋 Guia Completo - Sincronização de Vouchers Buddha Spa

## ✅ STATUS: Implementado e Funcionando
**Unidade:** Shopping Metrópole  
**Data:** 06/06/2026  
**Testado:** Junho 2026 (01 a 06)

---

## 🎯 O QUE FOI IMPLEMENTADO

Sistema de sincronização de vouchers do WordPress com 3 categorias distintas:

### 1️⃣ **Vouchers SITE**
- **Filtro:** Data de UTILIZAÇÃO (date_used_start / date_used_end)
- **Reembolso:** Sim (valores variados)
- **Exibição:** Total de reembolso + lista de vouchers

### 2️⃣ **Vouchers OMNICHANNEL**
- **Filtro:** Data de VENDA (date_sell_start / date_sell_end) + flag `is_omnichannel=on`
- **Reembolso:** Sim (valores variados)
- **Exibição:** Total de reembolso + lista de vouchers

### 3️⃣ **Vouchers CORTESIA**
- **Filtro:** Data de UTILIZAÇÃO (date_used_start / date_used_end)
- **Critério:** valorReembolso = 0
- **Reembolso:** Não (R$ 0)
- **Exibição:** Total de VALOR (extraído do nome do produto) + lista apenas de cortesias

---

## 🔧 ARQUIVOS MODIFICADOS

### 1. Parser HTML
**Arquivo:** `src/lib/wordpress/vouchers.ts`

**Correções principais:**
- ✅ Busca tbody com `id="the-list"` (múltiplos tbody na página)
- ✅ Regex corrigida para extrair total do card correto: `<span>R$ X</span></h5>...<div>Reembolso`
- ✅ Parser específico `parseVouchersCortesia()` que filtra valorReembolso = 0
- ✅ Extração de totalValor do nome do produto para cortesias

### 2. API de Sincronização
**Arquivo:** `src/app/api/vouchers/sync/route.ts`

**Alterações:**
- ✅ Importa `parseVouchersCortesia`
- ✅ Usa parser correto baseado no tipo (cortesia vs site/omni)

### 3. Script de Sincronização
**Arquivo:** `scripts/sync-junho-corrigido.js`

**URLs corretas:**
```javascript
// SITE
https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=2026-06-01&date_used_end=2026-06-06&affilliation_id=894555

// OMNICHANNEL
https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=2026-06-01&date_sell_end=2026-06-06&date_used_start=&date_used_end=&is_omnichannel=on&affilliation_id=894555

// CORTESIA
https://buddhaspa.com.br/wp-admin/admin.php?page=vouchers&status=&product_id=0&category_id=0&date_sell_start=&date_sell_end=&date_used_start=2026-06-01&date_used_end=2026-06-06&affilliation_id=894555
```

---

## 📝 COMO SINCRONIZAR (PASSO A PASSO)

### Para Shopping Metrópole:

#### 1. Fazer Login no WordPress
```
URL: https://buddhaspa.com.br/wp-admin
Login: adm.shoppingmetropole@buddhaspa.com.br
Senha: Metro@1056
```

#### 2. Abrir Console do Chrome
- Pressione **F12**
- Vá para aba **Console**

#### 3. Executar Script de Sincronização
- Abra o arquivo: `scripts/sync-junho-corrigido.js`
- Copie TODO o conteúdo
- Cole no Console
- Pressione **Enter**

#### 4. Aguardar Conclusão
Você verá:
```
🚀 Sincronizando JUNHO (2026-06-01 a 2026-06-06)...

📅 Processando SITE...
  ✓ HTML recebido: 1021.5 KB
  ✅ 31 vouchers | R$ 5446

📅 Processando OMNICHANNEL...
  ✓ HTML recebido: 996.5 KB
  ✅ 2 vouchers | R$ 308

📅 Processando CORTESIA...
  ✓ HTML recebido: 1021.5 KB
  ✅ 0 vouchers | R$ 0

✅ JUNHO SINCRONIZADO COM FILTROS CORRETOS!
```

#### 5. Atualizar Dashboard
- Acesse: `http://localhost:3000/vouchers`
- Pressione **Ctrl+F5** (recarregar ignorando cache)

---

## 🔄 REPLICAR PARA OUTRAS UNIDADES

### Passo 1: Obter Dados da Unidade

Para cada unidade, você precisa:

| Dado | Onde Encontrar |
|------|----------------|
| **Affiliation ID** | WordPress Admin > Vouchers > URL (parâmetro `affilliation_id`) |
| **Login WordPress** | Credenciais de admin da unidade |
| **Senha WordPress** | Credenciais de admin da unidade |

### Passo 2: Criar Script Personalizado

Copie `scripts/sync-junho-corrigido.js` para `scripts/sync-[NOME-UNIDADE].js`

**Altere apenas:**
```javascript
const AFFILIATION = '894555'; // ← TROCAR pelo ID da nova unidade
```

### Passo 3: Executar Script

1. Login no WordPress da nova unidade
2. Console do Chrome (F12)
3. Colar e executar o script personalizado
4. Ctrl+F5 no dashboard

---

## 📊 ESTRUTURA DE DADOS

### Cache Salvo
```
cache/
├── vouchers-site.json
├── vouchers-omnichannel.json
└── vouchers-cortesia.json
```

### Chave de Cache
```
"2026-06-01_2026-06-06": {
  dataIni: "2026-06-01",
  dataFim: "2026-06-06",
  totalReembolso: 5446,
  totalValor: 0,  // Só para cortesias
  totalValidados: 31,
  vouchers: [...]
}
```

⚠️ **IMPORTANTE:** A chave do cache DEVE bater com o período solicitado na página!
- Se a página pede 01/06 a 06/06, o cache deve ter a chave "2026-06-01_2026-06-06"
- Não salvar período completo (01 a 30) quando a página busca parcial (01 a 06)

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: "0 vouchers" mesmo com HTML grande
**Causa:** Regex pegando tbody errado (há 3-4 tbody na página)  
**Solução:** Parser já corrigido para buscar `tbody[id="the-list"]`

### Problema 2: Total R$ 154 ao invés de R$ 5.446
**Causa:** Regex pegando "Valor de Reembolso" (coluna) ao invés do card de total  
**Solução:** Regex já corrigida: `<span>R$ X</span></h5>...<div>Reembolso`

### Problema 3: Vouchers do Site aparecendo como Omnichannel
**Causa:** Falta flag `is_omnichannel=on` na URL  
**Solução:** Script já corrigido com flag correto

### Problema 4: Cortesias mostrando todos os vouchers
**Causa:** Não estava filtrando por valorReembolso = 0  
**Solução:** Parser `parseVouchersCortesia()` já filtra corretamente

### Problema 5: Dashboard mostrando zeros mesmo após sync
**Causa:** Chave do cache diferente do período solicitado  
**Solução:** Sincronizar com período exato que a página busca (hoje: 01 a 06)

---

## 🔐 CREDENCIAIS POR UNIDADE

### Shopping Metrópole

**WordPress:**
```
Affiliation ID: 894555
Login: adm.shoppingmetropole@buddhaspa.com.br
Senha: Metro@1056
```

**Belle Software:**
```
Email: adm.shoppingmetropole@buddhaspa.com.br
Senha: Metr@1056
Estabelecimento ID: 1
Base URL: https://app.bellesoftware.com.br/api/release/controller
```

### [Outras Unidades]
*Adicionar conforme necessário*

---

## 📅 PERIODICIDADE

### Sincronização Manual (Atual)
- Executar script no Console do Chrome
- Frequência: Conforme necessidade

### Automação Futura (Planejado)
- ScrapingBee API
- Cron diário/mensal
- Ver: `AUTOMACAO-VOUCHERS.md`

---

## 🎓 LIÇÕES APRENDIDAS

### Parser HTML WordPress
1. **Múltiplos tbody:** Sempre buscar pelo ID específico (`the-list`)
2. **Regex de total:** Usar estrutura exata do card, não textos genéricos
3. **Linhas em uma única linha:** HTML não tem quebras, usar regex com `[\s\S]*?`
4. **Atributos em tags:** `<tbody[^>]*>` ao invés de `<tbody>`

### Diferenciação de Tipos
1. **Site:** date_used (quando foi usado)
2. **Omnichannel:** date_sell + flag `is_omnichannel=on` (quando foi vendido)
3. **Cortesia:** date_used + filtro backend `valorReembolso = 0`

### Cache
1. **Chave exata:** Período deve bater exatamente
2. **Mês atual:** Usar data de hoje como fim, não fim do mês
3. **Meses anteriores:** Usar mês completo

---

## ✅ CHECKLIST PRÉ-DEPLOY NOVA UNIDADE

- [ ] Obter Affiliation ID
- [ ] Obter credenciais WordPress
- [ ] Testar login no WordPress
- [ ] Criar script personalizado
- [ ] Testar sincronização de 1 mês
- [ ] Verificar 3 tipos (Site, Omni, Cortesia)
- [ ] Conferir totais com WordPress manualmente
- [ ] Documentar credenciais (seguro)

---

**Documentação criada em:** 06/06/2026  
**Última atualização:** 06/06/2026  
**Responsável:** Daniana Matos / Claude Code
