# 🚀 Configuração Rápida - Google Places API

**Tempo estimado:** 10-15 minutos

---

## ✅ Checklist de Configuração

- [ ] **Passo 1:** Criar conta no Google Cloud Platform
- [ ] **Passo 2:** Criar projeto "Buddha Spa Dashboard"
- [ ] **Passo 3:** Ativar "Places API (New)"
- [ ] **Passo 4:** Criar API Key
- [ ] **Passo 5:** Restringir API Key (segurança)
- [ ] **Passo 6:** Copiar API Key para `.env.local`
- [ ] **Passo 7:** Executar script para encontrar Place IDs
- [ ] **Passo 8:** Copiar Place IDs para `.env.local`
- [ ] **Passo 9:** Reiniciar servidor
- [ ] **Passo 10:** Verificar dados no dashboard

---

## 📋 Comandos Necessários

### 1. Adicionar API Key no .env.local
```bash
# Abra o arquivo .env.local e adicione:
GOOGLE_PLACES_API_KEY=sua_api_key_aqui
```

### 2. Executar script para encontrar Place IDs
```bash
node scripts/find-place-id.mjs
```

### 3. Copiar resultado para .env.local
O script vai gerar algo assim:
```bash
PLACE_ID_SHOPPING_METROPOLE=ChIJ...
PLACE_ID_ANALIA_FRANCO=ChIJ...
# ... outras unidades
```

Copie e cole no `.env.local`

### 4. Reiniciar servidor
```bash
# Pare o servidor (Ctrl+C) e inicie novamente:
npm run dev
```

### 5. Acessar dashboard
```
http://localhost:3000/dashboard
```

---

## 📖 Guia Completo

Para instruções detalhadas passo a passo, veja:
**[GOOGLE-PLACES-API.md](./GOOGLE-PLACES-API.md)**

---

## 🆘 Precisa de Ajuda?

### Erro: "API key not valid"
- Verifique se copiou a chave corretamente
- Verifique se ativou a "Places API (New)" no Google Cloud

### Erro: "ZERO_RESULTS"
- O Place ID pode estar incorreto
- Use o Place ID Finder: https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder

### Script não encontra as unidades
- Verifique sua conexão com internet
- Tente ajustar o nome da busca em `scripts/find-place-id.mjs`

---

## 💰 Quanto Custa?

**GRÁTIS!** ✅

- Google dá **$200/mês** de créditos gratuitos
- Precisamos de apenas **~210 requisições/mês**
- Valor: **$0,00/mês**

---

## ⏰ Próximos Passos

Após configurar:
1. ✅ Dashboard mostrará avaliações do Google automaticamente
2. ✅ Dados atualizados diariamente
3. ✅ Funciona para todas as 7 unidades
4. ✅ Sem custo adicional

**Bom trabalho! 🎉**
