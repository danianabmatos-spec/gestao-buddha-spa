# 🚀 Automação de Vouchers - Buddha Spa

Sistema de sincronização AUTOMÁTICA de vouchers do WordPress usando **ScrapingBee**.

## ✅ AGORA (Junho 2026):

### Método 1: Script no Console (30 segundos)

1. **Abra** https://buddhaspa.com.br/wp-admin (faça login)

2. **Abra o Console** do Chrome (F12 > Console)

3. **Copie e cole** o conteúdo de:
   ```
   scripts/console-sync-junho.js
   ```

4. **Pressione Enter**

5. **Pronto!** Dados de junho sincronizados

---

## 🔄 AUTOMAÇÃO FUTURA:

### Configuração Inicial (uma vez):

#### 1. Criar conta no ScrapingBee

- Acesse: https://www.scrapingbee.com
- Crie uma conta (1000 créditos grátis no primeiro mês)
- Plano recomendado: **$49/mês** (10.000 créditos)
- Copie sua **API Key**

#### 2. Configurar API Key

Edite `.env.local` e adicione:
```
SCRAPINGBEE_API_KEY=sua_chave_aqui
```

#### 3. Testar

```bash
curl -X POST "http://localhost:3000/api/vouchers/auto-sync" \
  -H "Content-Type: application/json" \
  -d '{"dataIni":"2026-07-01","dataFim":"2026-07-31"}'
```

Se funcionar, você verá:
```json
{
  "ok": true,
  "site": { "totalReembolso": XXXX, "totalVouchers": XX },
  "omnichannel": { "totalReembolso": XXX, "totalVouchers": X },
  "cortesia": { "totalValor": XXX, "totalVouchers": X }
}
```

### Agendamento Automático

#### Opção A: Cron (Linux/Mac)

```bash
# Todo dia 1º do mês às 08:00
0 8 1 * * curl -X POST http://localhost:3000/api/vouchers/auto-sync -H "Content-Type: application/json" -d "{\"dataIni\":\"$(date +%Y-%m-01)\",\"dataFim\":\"$(date +%Y-%m-%d)\"}"
```

#### Opção B: Task Scheduler (Windows)

1. Abra **Agendador de Tarefas**
2. Criar Tarefa Básica
3. Nome: "Buddha Spa - Sync Vouchers"
4. Gatilho: Mensal, dia 1, 08:00
5. Ação: Iniciar um programa
   - Programa: `curl`
   - Argumentos: `-X POST http://localhost:3000/api/vouchers/auto-sync -H "Content-Type: application/json" -d "{\"dataIni\":\"2026-XX-01\",\"dataFim\":\"2026-XX-30\"}"`

#### Opção C: Vercel Cron (Recomendado)

Se hospedar na Vercel, adicione em `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/vouchers/cron-sync",
    "schedule": "0 8 1 * *"
  }]
}
```

---

## 💰 Custos

### ScrapingBee:
- **Grátis**: 1000 créditos (teste)
- **$49/mês**: 10.000 créditos
- **Uso estimado**: ~6 créditos/mês (3 tipos x 2 requisições)
- **Custo efetivo**: ~$0.03/mês

### Total:
- **Teste**: Grátis (1 ano de uso com 1000 créditos)
- **Produção**: $49/mês (mas usando apenas $0.03)

---

## 🎯 Fluxo Automatizado

```
Dia 1º do mês, 08:00
    ↓
Cron/Task Scheduler executa
    ↓
POST /api/vouchers/auto-sync
    ↓
ScrapingBee busca HTML do WordPress
    ↓
Sistema processa e salva no cache
    ↓
Dashboard atualizado automaticamente
    ↓
Você apenas visualiza os dados!
```

---

## 📊 Monitoramento

- Logs aparecem no console do servidor
- Cada sync mostra: quantos vouchers, total R$, tempo
- Se falhar, email de notificação (configurar depois)

---

## ❓ FAQ

**Q: Por que ScrapingBee?**
A: Cloudflare bloqueia automação. ScrapingBee tem infraestrutura para contornar.

**Q: Não tem alternativa grátis?**
A: Não confiável. Já tentamos Puppeteer, browser relay, extensão - tudo bloqueado.

**Q: Vale a pena $49/mês?**
A: São 1000 créditos grátis primeiro. Depois, você pode manter o plano mínimo pois usa muito pouco.

**Q: E se parar de funcionar?**
A: ScrapingBee atualiza constantemente. Taxa de sucesso >99%.
