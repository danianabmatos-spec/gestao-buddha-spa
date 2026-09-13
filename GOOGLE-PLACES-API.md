# Google Places API - Guia de Configuração

**Data:** 2026-06-13  
**Objetivo:** Integrar Google Places API para atualização automática de avaliações do Google

---

## 🔑 Passo 1: Criar Projeto no Google Cloud Platform

### 1.1 Acessar Google Cloud Console
1. Acesse: https://console.cloud.google.com/
2. Faça login com sua conta Google (recomendado usar a conta do Google Business)

### 1.2 Criar Novo Projeto
1. Clique no seletor de projeto (topo da página)
2. Clique em **"Novo Projeto"**
3. Nome do projeto: `Buddha Spa Dashboard`
4. Clique em **"Criar"**

---

## 📍 Passo 2: Ativar Google Places API (New)

### 2.1 Ativar a API
1. No menu lateral, vá em: **APIs e Serviços** > **Biblioteca**
2. Pesquise por: `Places API (New)`
3. Clique em **"Places API (New)"**
4. Clique em **"Ativar"**

---

## 🔐 Passo 3: Criar API Key

### 3.1 Gerar Credencial
1. No menu lateral, vá em: **APIs e Serviços** > **Credenciais**
2. Clique em **"Criar Credenciais"** > **"Chave de API"**
3. Sua API Key será criada (ex: `AIzaSyA...`)

### 3.2 Restringir a API Key (IMPORTANTE - Segurança)
1. Clique em **"Restringir chave"**
2. Em **"Restrições de aplicativo"**:
   - Selecione: **"Endereços IP"**
   - Adicione o IP do seu servidor (ou `0.0.0.0/0` para desenvolvimento)
3. Em **"Restrições de API"**:
   - Selecione: **"Restringir chave"**
   - Marque apenas: **"Places API (New)"**
4. Clique em **"Salvar"**

### 3.3 Copiar API Key
- Copie a API Key gerada (exemplo: `AIzaSyA_exemplo_12345`)
- **GUARDE EM LOCAL SEGURO** - você vai precisar dela

---

## 🏢 Passo 4: Encontrar o Place ID das Unidades

### 4.1 O que é Place ID?
- É um identificador único do Google para cada local/estabelecimento
- Exemplo: `ChIJN1t_tDeuEmsRUsoyG83frY4`

### 4.2 Como encontrar (Método 1 - Pelo Script)
Vamos criar um script que busca automaticamente. Você vai precisar:
- Nome da unidade: `Buddha Spa Shopping Metrópole`
- Endereço completo: `Shopping Metrópole, São Bernardo do Campo, SP`

### 4.3 Como encontrar (Método 2 - Manual)
1. Acesse: https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder
2. Digite o nome da unidade na busca
3. Clique no resultado
4. O Place ID aparecerá abaixo do mapa

---

## ⚙️ Passo 5: Configurar no Projeto

### 5.1 Adicionar API Key no .env.local
Abra o arquivo `.env.local` e adicione:

```bash
# Google Places API
GOOGLE_PLACES_API_KEY=AIzaSyA_sua_api_key_aqui
```

### 5.2 Adicionar Place IDs das Unidades
Adicione também os Place IDs de cada unidade:

```bash
# Place IDs das Unidades
PLACE_ID_SHOPPING_METROPOLE=ChIJ_seu_place_id_aqui
# PLACE_ID_ANALIA_FRANCO=ChIJ_...
# PLACE_ID_PERDIZES=ChIJ_...
# ... outras unidades
```

---

## 📊 Passo 6: Testar a Integração

### 6.1 Rodar o Script de Teste
Execute o comando:
```bash
node scripts/test-google-places.mjs
```

### 6.2 Resultado Esperado
Você deve ver:
```
✅ Conexão com Google Places API: OK
📍 Place ID encontrado: ChIJ...
⭐ Nota: 4.9
📊 Total de avaliações: 234
```

---

## 💰 Custos e Limites

### Plano Gratuito
- **$200 em créditos** gratuitos por mês
- **1.000 requisições** gratuitas por mês para Place Details
- Depois disso: **$17 por 1.000 requisições**

### Nossa Estimativa
- Dashboard atualiza **1x por dia** = 30 requisições/mês
- 7 unidades = 210 requisições/mês
- **TOTALMENTE GRÁTIS** ✅

### Como Evitar Custos
1. Use cache (dados atualizados 1x por dia)
2. Não abuse de requisições
3. Configure alertas de billing no Google Cloud

---

## 🔒 Segurança

### Boas Práticas
1. ✅ **NUNCA** compartilhe sua API Key publicamente
2. ✅ **SEMPRE** use restrições de IP/API
3. ✅ **SEMPRE** use variáveis de ambiente (.env.local)
4. ✅ Adicione `.env.local` no `.gitignore`
5. ✅ Configure alertas de uso no Google Cloud

### Se a API Key Vazar
1. Acesse: Google Cloud Console > Credenciais
2. Delete a chave comprometida
3. Crie uma nova chave
4. Atualize o `.env.local`

---

## 📝 Dados Disponíveis na API

### ✅ Dados que a API fornece:
- ⭐ **Rating** (nota atual - ex: 4.9)
- 📊 **Total de avaliações** (ex: 234)
- 📍 **Place ID**
- 📍 **Endereço**
- 📞 **Telefone**
- 🌐 **Website**
- 📅 **Horários de funcionamento**

### ❌ Dados que a API NÃO fornece:
- 📊 **Distribuição de estrelas** (quantas 5★, 4★, etc.)
  - Este dado não está disponível na API pública
  - Solução: Vamos estimar baseado na nota e total

---

## 🔗 Links Úteis

- [Google Cloud Console](https://console.cloud.google.com/)
- [Places API Documentation](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Place ID Finder](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder)
- [Pricing Calculator](https://cloud.google.com/maps-platform/pricing)

---

## 🆘 Problemas Comuns

### Erro: "This API project is not authorized to use this API"
**Solução:** Certifique-se de que ativou a "Places API (New)" no projeto correto

### Erro: "API key not valid"
**Solução:** Verifique se copiou a API key corretamente e se ela está no .env.local

### Erro: "REQUEST_DENIED"
**Solução:** A API key pode estar com restrições muito rígidas. Verifique as configurações de restrição.

### Erro: "ZERO_RESULTS"
**Solução:** O Place ID pode estar incorreto. Use o Place ID Finder para verificar.

---

**Próximo passo:** Execute o script de configuração para obter os Place IDs automaticamente!
