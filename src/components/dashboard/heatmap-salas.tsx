'use client'

import type { BelleAgendamento } from '@/lib/belle/types'

interface HeatmapSalasProps {
  agendamentos: BelleAgendamento[]
  dataLabel: string
}

const HORAS = Array.from({ length: 12 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`)

function intensidadeCor(count: number, max: number): string {
  if (count === 0 || max === 0) return '#F5F0EB'
  const t = count / max
  if (t < 0.25) return '#EDD9BE'
  if (t < 0.50) return '#DDC7A4'
  if (t < 0.75) return '#B87A3C'
  return '#7E0000'
}

function textoContraste(count: number, max: number): string {
  return max > 0 && count / max >= 0.75 ? '#FFFFFF' : '#392617'
}

function normalizarSala(sala: string | null | undefined): string {
  if (!sala?.trim()) return 'Sem sala'
  return sala.trim()
}

export function HeatmapSalas({ agendamentos, dataLabel }: HeatmapSalasProps) {
  // Monta mapa: sala → hora → count
  const mapa = new Map<string, Map<string, number>>()

  for (const ag of agendamentos) {
    if (!ag.hrIni || !ag.nom_paciente?.trim()) continue
    const hora = ag.hrIni.slice(0, 2) + ':00'
    const sala = normalizarSala(ag.sala)
    if (!mapa.has(sala)) mapa.set(sala, new Map())
    const m = mapa.get(sala)!
    m.set(hora, (m.get(hora) ?? 0) + 1)
  }

  const salas = Array.from(mapa.keys()).sort()

  // Total por sala para ranking
  const totalPorSala = new Map<string, number>()
  for (const [sala, horaMap] of mapa.entries()) {
    totalPorSala.set(sala, Array.from(horaMap.values()).reduce((a, b) => a + b, 0))
  }
  const salasOrdenadas = salas.sort((a, b) => (totalPorSala.get(b) ?? 0) - (totalPorSala.get(a) ?? 0))

  const max = Math.max(
    ...Array.from(mapa.values()).flatMap(m => Array.from(m.values())),
    1
  )

  if (salas.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">Nenhuma sala registrada</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#7E0000] uppercase tracking-wide">
            Ocupação por Sala
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{dataLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Salas ativas</p>
          <p className="text-sm font-bold text-[#7E0000]">{salas.filter(s => s !== 'Sem sala').length}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Header de horas */}
        <div
          className="grid gap-1 mb-1 min-w-max"
          style={{ gridTemplateColumns: `100px repeat(${HORAS.length}, 40px)` }}
        >
          <div /> {/* espaço para label da sala */}
          {HORAS.map(h => (
            <div key={h} className="text-[9px] text-center text-muted-foreground font-medium">
              {h.slice(0, 2)}h
            </div>
          ))}
        </div>

        {/* Linhas de sala */}
        <div className="space-y-1 min-w-max">
          {salasOrdenadas.map(sala => {
            const horaMap = mapa.get(sala) ?? new Map()
            const totalSala = totalPorSala.get(sala) ?? 0
            return (
              <div
                key={sala}
                className="grid gap-1 items-center"
                style={{ gridTemplateColumns: `100px repeat(${HORAS.length}, 40px)` }}
              >
                {/* Nome da sala */}
                <div className="text-[10px] font-medium text-[#392617] truncate pr-1" title={sala}>
                  {sala}
                  <span className="text-muted-foreground ml-1">({totalSala})</span>
                </div>
                {/* Células de hora */}
                {HORAS.map(hora => {
                  const count = horaMap.get(hora) ?? 0
                  const bg = intensidadeCor(count, max)
                  const color = textoContraste(count, max)
                  return (
                    <div
                      key={hora}
                      title={`${sala} — ${hora}: ${count} atend.`}
                      className="h-8 rounded-md flex items-center justify-center cursor-default transition-transform hover:scale-110"
                      style={{ backgroundColor: bg }}
                    >
                      {count > 0 && (
                        <span className="text-[11px] font-bold" style={{ color }}>
                          {count}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-muted-foreground">Livre</span>
        <div className="flex gap-0.5 flex-1">
          {['#F5F0EB', '#EDD9BE', '#DDC7A4', '#B87A3C', '#7E0000'].map(c => (
            <div key={c} className="flex-1 h-2 rounded-sm" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">Ocupado</span>
      </div>
    </div>
  )
}
