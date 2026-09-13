import type { NPSResult } from '@/lib/belle/relatorio-nps'

interface NPSCardsProps {
  data: NPSResult
}

export function NPSCards({ data }: NPSCardsProps) {
  const getNPSColor = (nps: number) => {
    if (nps >= 75) return 'text-[#425F1D]' // Verde - Excelente
    if (nps >= 50) return 'text-[#D78B18]' // Dourado - Muito bom
    if (nps >= 0) return 'text-[#392617]' // Terra - Bom
    return 'text-[#7E0000]' // Marsala - Precisa melhorar
  }

  const getNPSLabel = (nps: number) => {
    if (nps >= 75) return 'Excelente'
    if (nps >= 50) return 'Muito Bom'
    if (nps >= 0) return 'Bom'
    return 'Precisa Melhorar'
  }

  const CardNPS = ({
    title,
    promotores,
    neutros,
    detratores,
    total,
    nps
  }: {
    title: string
    promotores: number
    neutros: number
    detratores: number
    total: number
    nps: number
  }) => (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-[#DDC7A4]/30">
      <h3 className="text-sm font-semibold text-[#392617]/70 uppercase tracking-wide mb-4">
        {title}
      </h3>

      {/* NPS Score */}
      <div className="mb-4">
        <div className={`text-4xl font-bold ${getNPSColor(nps)}`}>
          {nps}
        </div>
        <div className="text-xs text-[#392617]/60 mt-1">
          {getNPSLabel(nps)}
        </div>
      </div>

      {/* Detalhamento */}
      <div className="space-y-2 pt-4 border-t border-[#DDC7A4]/20">
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#392617]/70">Promotores (9-10)</span>
          <span className="font-semibold text-[#425F1D]">
            {promotores} ({total > 0 ? ((promotores / total) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#392617]/70">Neutros (7-8)</span>
          <span className="font-semibold text-[#D78B18]">
            {neutros} ({total > 0 ? ((neutros / total) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#392617]/70">Detratores (0-6)</span>
          <span className="font-semibold text-[#7E0000]">
            {detratores} ({total > 0 ? ((detratores / total) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <div className="flex justify-between items-center text-sm pt-2 border-t border-[#DDC7A4]/20">
          <span className="text-[#392617] font-medium">Total de Respostas</span>
          <span className="font-bold text-[#392617]">{total}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CardNPS
        title="NPS Profissionais"
        promotores={data.profissionais.promotores}
        neutros={data.profissionais.neutros}
        detratores={data.profissionais.detratores}
        total={data.profissionais.total}
        nps={data.profissionais.nps}
      />
      <CardNPS
        title="NPS Atendimento"
        promotores={data.atendimento.promotores}
        neutros={data.atendimento.neutros}
        detratores={data.atendimento.detratores}
        total={data.atendimento.total}
        nps={data.atendimento.nps}
      />
      <CardNPS
        title="NPS Unidade"
        promotores={data.unidade.promotores}
        neutros={data.unidade.neutros}
        detratores={data.unidade.detratores}
        total={data.unidade.total}
        nps={data.unidade.nps}
      />
    </div>
  )
}
