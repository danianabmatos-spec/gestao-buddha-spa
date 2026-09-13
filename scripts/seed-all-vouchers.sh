#!/bin/bash

# Script para carregar todos os dados de vouchers (fev-jun 2026)

BASE_URL="http://localhost:3000/api/vouchers"

echo "🔄 Carregando vouchers de FEVEREIRO 2026..."
curl -X POST "${BASE_URL}/seed-fevereiro/route" -H "Content-Type: application/json" -d '{"tipo":"site"}' && echo ""
curl -X POST "${BASE_URL}/seed-fevereiro/route" -H "Content-Type: application/json" -d '{"tipo":"omnichannel"}' && echo ""
curl -X POST "${BASE_URL}/seed-fevereiro/route" -H "Content-Type: application/json" -d '{"tipo":"cortesia"}' && echo ""

echo ""
echo "🔄 Carregando vouchers de MARÇO 2026..."
curl -X POST "${BASE_URL}/seed-marco/route" && echo ""

echo ""
echo "🔄 Carregando vouchers de ABRIL 2026..."
curl -X POST "${BASE_URL}/seed-abril/route" -H "Content-Type: application/json" -d '{"tipo":"site"}' && echo ""
curl -X POST "${BASE_URL}/seed-abril/route" -H "Content-Type: application/json" -d '{"tipo":"omnichannel"}' && echo ""
curl -X POST "${BASE_URL}/seed-abril/route" -H "Content-Type: application/json" -d '{"tipo":"cortesia"}' && echo ""

echo ""
echo "🔄 Carregando vouchers de MAIO 2026..."
curl -X POST "${BASE_URL}/seed-maio/route" -H "Content-Type: application/json" -d '{"tipo":"site"}' && echo ""
curl -X POST "${BASE_URL}/seed-maio/route" -H "Content-Type: application/json" -d '{"tipo":"omnichannel"}' && echo ""
curl -X POST "${BASE_URL}/seed-maio/route" -H "Content-Type: application/json" -d '{"tipo":"cortesia"}' && echo ""

echo ""
echo "🔄 Carregando vouchers de JUNHO 2026..."
curl -X POST "${BASE_URL}/seed-junho/route" -H "Content-Type: application/json" -d '{"tipo":"site"}' && echo ""
curl -X POST "${BASE_URL}/seed-junho/route" -H "Content-Type: application/json" -d '{"tipo":"omnichannel"}' && echo ""
curl -X POST "${BASE_URL}/seed-junho/route" -H "Content-Type: application/json" -d '{"tipo":"cortesia"}' && echo ""

echo ""
echo "✅ Todos os dados foram carregados!"
echo ""
echo "📊 Resumo por mês:"
echo "  • Fevereiro: Site (~R$ 18.500) + Omni (R$ 435,20) + Cortesia (1x R$ 233)"
echo "  • Março: Site + Omni + Cortesia (2x R$ 466)"
echo "  • Abril: Site (~R$ 24.300) + Omni (R$ 961,60) + Cortesia (sem dados)"
echo "  • Maio: Site (R$ 27.629) + Omni (R$ 1.536,80) + Cortesia (sem dados)"
echo "  • Junho: Site (R$ 3.898) + Omni (R$ 175,20) + Cortesia (1x R$ 233)"
