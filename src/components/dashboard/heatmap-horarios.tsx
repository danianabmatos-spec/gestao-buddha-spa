'use client'

import type { BelleAgendamento } from '@/lib/belle/types'
import { parseISO, getDay } from 'date-fns'

interface HeatmapHorariosProps {
  agendamentos: Array<BelleAgendamento & { data?: string }>
  dataLabel: string
  usarMapaSemanal?: boolean
}

// Gera faixas de hora: 10:00 a 22:00 (horário de funcionamento)
const HORAS = Array.from({ length: 13 }, (_, i) => `${String(i + 10).padStart(2, '0')}:00`)

// Dias da semana (domingo = 0, segunda = 1, ... sábado = 6)
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function intensidadeCor(count: number, max: number): string {
  if (count === 0 || max === 0) return '#F5F0EB'
  const t = count / max
  if (t < 0.25) return '#EDD9BE'       // areia claro
  if (t < 0.50) return '#DDC7A4'       // areia
  if (t < 0.75) return '#B87A3C'       // dourado escuro
  return '#7E0000'                      // marsala
}

function textoContraste(count: number, max: number): string {
  const t = max > 0 ? count / max : 0
  return t >= 0.75 ? '#FFFFFF' : '#392617'
}

export function HeatmapHorarios({ agendamentos, dataLabel, usarMapaSemanal = false }: HeatmapHorariosProps) {
  // Se não usar mapa semanal, usa a versão antiga (por horário do dia)
  if (!usarMapaSemanal) {
    const porHora = new Map<string, number>()
    for (const ag of agendamentos) {
      if (!ag.hrIni || !ag.nom_paciente?.trim()) continue
      const hora = ag.hrIni.slice(0, 2) + ':00'
      porHora.set(hora, (porHora.get(hora) ?? 0) + 1)
    }

    const max = Math.max(...Array.from(porHora.values()), 1)
    const total = Array.from(porHora.values()).reduce((a, b) => a + b, 0)
    const horaPico = Array.from(porHora.entries()).sort((a, b) => b[1] - a[1])[0]

    return (
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#7E0000] uppercase tracking-wide">
              Ocupação por Horário
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{dataLabel}</p>
          </div>
          {horaPico && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Horário pico</p>
              <p className="text-sm font-bold text-[#7E0000]">{horaPico[0]}</p>
              <p className="text-[10px] text-muted-foreground">{horaPico[1]} atend.</p>
            </div>
          )}
        </div>

        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${HORAS.length}, 1fr)` }}>
          {HORAS.map(hora => {
            const count = porHora.get(hora) ?? 0
            const bg = intensidadeCor(count, max)
            const color = textoContraste(count, max)
            return (
              <div
                key={hora}
                title={`${hora} — ${count} atendimento${count !== 1 ? 's' : ''}`}
                className="rounded-md flex flex-col items-center justify-center aspect-square cursor-default transition-transform hover:scale-110"
                style={{ backgroundColor: bg }}
              >
                <span className="text-[9px] font-medium leading-tight" style={{ color }}>
                  {hora.slice(0, 2)}h
                </span>
                {count > 0 && (
                  <span className="text-[11px] font-bold leading-none mt-0.5" style={{ color }}>
                    {count}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-muted-foreground">Vazio</span>
          <div className="flex gap-0.5 flex-1">
            {['#F5F0EB', '#EDD9BE', '#DDC7A4', '#B87A3C', '#7E0000'].map(c => (
              <div key={c} className="flex-1 h-2 rounded-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">Cheio</span>
        </div>

        <p className="text-[10px] text-muted-foreground mt-1 text-right">
          Total: <span className="font-semibold">{total}</span> atendimentos
        </p>
      </div>
    )
  }

  // MAPA SEMANAL: Dia da semana x Horário
  // Estrutura: Map<diaSemana_hora, count>
  const mapaSemanal = new Map<string, number>()

  for (const ag of agendamentos) {
    if (!ag.hrIni || !ag.nom_paciente?.trim() || !ag.data) continue

    const diaSemana = getDay(parseISO(ag.data)) // 0-6 (domingo-sábado)
    const hora = ag.hrIni.slice(0, 2) + ':00'
    const chave = `${diaSemana}_${hora}`

    mapaSemanal.set(chave, (mapaSemanal.get(chave) ?? 0) + 1)
  }

  const max = Math.max(...Array.from(mapaSemanal.values()), 1)
  const total = Array.from(mapaSemanal.values()).reduce((a, b) => a + b, 0)

  // Encontra o horário e dia de pico
  let picoChave = ''
  let picoValor = 0
  for (const [chave, valor] of mapaSemanal.entries()) {
    if (valor > picoValor) {
      picoValor = valor
      picoChave = chave
    }
  }

  let picoTexto = ''
  if (picoChave) {
    const [dia, hora] = picoChave.split('_')
    picoTexto = `${DIAS_SEMANA[parseInt(dia)]} ${hora}`
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#7E0000] uppercase tracking-wide">
            Mapa de Calor — Dia da Semana × Horário
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{dataLabel}</p>
        </div>
        {picoTexto && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pico de Ocupação</p>
            <p className="text-sm font-bold text-[#7E0000]">{picoTexto}</p>
            <p className="text-[10px] text-muted-foreground">{picoValor} atend.</p>
          </div>
        )}
      </div>

      {/* Grid: Linhas = dias da semana, Colunas = horários */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Cabeçalho com horários */}
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '50px repeat(13, 1fr)' }}>
            <div></div>
            {HORAS.map(hora => (
              <div key={hora} className="text-center text-[9px] text-muted-foreground font-medium">
                {hora.slice(0, 2)}h
              </div>
            ))}
          </div>

          {/* Linhas por dia da semana */}
          {DIAS_SEMANA.map((dia, diaSemana) => (
            <div key={dia} className="grid gap-1 mb-1" style={{ gridTemplateColumns: '50px repeat(13, 1fr)' }}>
              {/* Label do dia */}
              <div className="flex items-center justify-end pr-2 text-[10px] font-semibold text-[#7E0000]">
                {dia}
              </div>

              {/* Células de cada horário */}
              {HORAS.map(hora => {
                const chave = `${diaSemana}_${hora}`
                const count = mapaSemanal.get(chave) ?? 0
                const bg = intensidadeCor(count, max)
                const color = textoContraste(count, max)

                return (
                  <div
                    key={chave}
                    title={`${dia} ${hora} — ${count} atendimento${count !== 1 ? 's' : ''}`}
                    className="rounded-md flex items-center justify-center aspect-square cursor-default transition-transform hover:scale-105"
                    style={{ backgroundColor: bg }}
                  >
                    {count > 0 && (
                      <span className="text-[10px] font-bold" style={{ color }}>
                        {count}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda de cor */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-muted-foreground">Vazio</span>
        <div className="flex gap-0.5 flex-1">
          {['#F5F0EB', '#EDD9BE', '#DDC7A4', '#B87A3C', '#7E0000'].map(c => (
            <div key={c} className="flex-1 h-2 rounded-sm" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">Cheio</span>
      </div>

      <p className="text-[10px] text-muted-foreground mt-1 text-right">
        Total: <span className="font-semibold">{total}</span> atendimentos no período
      </p>
    </div>
  )
}
