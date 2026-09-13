export interface MetaMensal {
  mes: number // 1-12
  metaUnidade: number
  metaRecepcao: number
  metaHoras: number
  realizadoUnidade?: number
  realizadoRecepcao?: number
  realizadoHoras?: number
}

export interface MetasUnidade {
  unidade: string
  ano: number
  metas: MetaMensal[]
}

export interface RealizadoMensal {
  mes: number
  realizadoUnidade: number
  realizadoRecepcao: number
  realizadoHoras: number
}

export interface MetaComRealizacao {
  mes: number
  mesNome: string

  metaUnidade: number
  realizadoUnidade: number
  percentualUnidade: number

  metaRecepcao: number
  realizadoRecepcao: number
  percentualRecepcao: number

  metaHoras: number
  realizadoHoras: number
  percentualHoras: number
}
