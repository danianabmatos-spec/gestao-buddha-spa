#!/bin/bash

# Script para sincronizar AUTOMATICAMENTE todos os meses (fev-jun 2026)
# Usa Puppeteer para login automático e scraping

BASE_URL="http://localhost:3000/api/vouchers/auto-sync"

echo "🚀 Iniciando auto-sync de TODOS os meses..."
echo ""

echo "📅 Fevereiro 2026..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"dataIni":"2026-02-01","dataFim":"2026-02-28"}' \
  2>&1 | grep -E '"ok"|"error"|totalReembolso|totalVouchers'

echo ""
echo "📅 Março 2026..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"dataIni":"2026-03-01","dataFim":"2026-03-31"}' \
  2>&1 | grep -E '"ok"|"error"|totalReembolso|totalVouchers'

echo ""
echo "📅 Abril 2026..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"dataIni":"2026-04-01","dataFim":"2026-04-30"}' \
  2>&1 | grep -E '"ok"|"error"|totalReembolso|totalVouchers'

echo ""
echo "📅 Maio 2026..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"dataIni":"2026-05-01","dataFim":"2026-05-31"}' \
  2>&1 | grep -E '"ok"|"error"|totalReembolso|totalVouchers'

echo ""
echo "📅 Junho 2026 (01-05)..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"dataIni":"2026-06-01","dataFim":"2026-06-05"}' \
  2>&1 | grep -E '"ok"|"error"|totalReembolso|totalVouchers'

echo ""
echo "✅ Auto-sync concluído!"
echo ""
echo "Acesse http://localhost:3000/vouchers para ver os resultados"
