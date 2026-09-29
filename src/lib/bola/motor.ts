/**
 * Motor do Controle da Bola (rodízio de terapeutas).
 *
 * Lógica PURA e sem dependências (nada de Next/Prisma/Belle aqui) — para ser
 * testável isoladamente e plugável no app depois.
 *
 * Regras (confirmadas pela Daniana, 2026-09-28):
 *  - Só entra na bola quem tem TURNO ABERTO hoje (escala do Belle) e fez check-in.
 *  - Base: ordem de chegada (check-in) + quem tem MENOS atendimentos atende primeiro.
 *  - 20 e 30 min MANTÊM a vez (não contam rodada) — os demais rodam.
 *  - Quem está em atendimento sai da bola. "Em atendimento" e "rodadas" vêm dos
 *    ATENDIMENTOS QUE A BOLA MANDOU (+ preferenciais) — NÃO do nome no agendamento
 *    do Belle (que é só um encaixe).
 *  - SÓ o cliente preferencial (verde no Belle) prende a terapeuta: reserva no
 *    próximo horário e não pode chocar. Agendamento comum é demanda que cai na bola.
 *  - Respeitar gênero pedido (Tipo Obs) e capacidade (terapias que ela faz).
 *  - Não aceitar atendimento que ultrapasse o fim do turno.
 *  - Sala é a que já está no agendamento do Belle (o motor só repassa).
 */

export type Genero = "F" | "M";

/** Cadastro da terapeuta (capacidade + gênero). Fonte: Belle "Relacionar Serviços". */
export interface TerapeutaBola {
  id: string; // cod_profissional do Belle
  nome: string;
  genero: Genero;
  servicos: number[] | null; // cod_servico que ela realiza; null = faz todas (cadastro ainda não carregado)
}

/** Turno de hoje (escala do Belle, dia da semana atual). */
export interface TurnoHoje {
  terapeutaId: string;
  inicioMin: number;
  fimMin: number;
}

/** Check-in do terapeuta — a FILA (única coisa que não existe no Belle). */
export interface CheckIn {
  terapeutaId: string;
  chegadaMin: number; // minutos desde 00:00
}

/**
 * Atendimento real: o que a BOLA mandou a terapeuta atender (ou um preferencial
 * que ela obrigatoriamente fez). É daqui que sai "ocupado" e "rodadas".
 */
export interface Atendimento {
  terapeutaId: string;
  inicioMin: number;
  fimMin: number;
  cliente?: string;
  servico?: string;
}

/** Preferencial futuro (verde no Belle, início > agora) — reserva a terapeuta. */
export interface PreferencialFuturo {
  terapeutaId: string;
  inicioMin: number;
  cliente: string;
}

/** Cliente que chegou e precisa de terapeuta (sala já vem do Belle). */
export interface Pedido {
  servicoCod: number;
  servicoNome: string;
  duracaoMin: number;
  generoPref: Genero | null;
  salaNome?: string;
}

export interface ConfigBola {
  /** Atendimentos com duração <= este valor mantêm a vez (não contam rodada). */
  duracaoMantemVezMax: number;
  /** Antecedência (min) para exibir "reservada" no painel. */
  reservaAntecedenciaMin: number;
}

export const CONFIG_PADRAO: ConfigBola = {
  duracaoMantemVezMax: 30,
  reservaAntecedenciaMin: 60,
};

export type StatusBola =
  | { tipo: "LIVRE" }
  | { tipo: "FORA_DE_TURNO" }
  | { tipo: "EM_ATENDIMENTO"; ateMin: number; cliente?: string; servico?: string }
  | { tipo: "RESERVADA"; preferencialInicioMin: number; cliente: string };

export interface EstadoTerapeuta {
  terapeuta: TerapeutaBola;
  chegadaMin: number;
  turnoFimMin: number | null;
  rodadas: number; // atendimentos concluídos que contam p/ rodízio (>30 min)
  atendimentosTotais: number; // todos concluídos hoje (inclui 20/30)
  status: StatusBola;
}

// ---------- helpers de tempo ----------
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function atendimentosDe(id: string, atendimentos: Atendimento[]): Atendimento[] {
  return atendimentos
    .filter((a) => a.terapeutaId === id)
    .sort((a, b) => a.inicioMin - b.inicioMin);
}

function proximoPreferencial(
  id: string,
  agoraMin: number,
  preferenciais: PreferencialFuturo[]
): PreferencialFuturo | null {
  return (
    preferenciais
      .filter((p) => p.terapeutaId === id && p.inicioMin > agoraMin)
      .sort((a, b) => a.inicioMin - b.inicioMin)[0] ?? null
  );
}

/**
 * Estado da bola: só terapeutas com turno aberto hoje E que fizeram check-in.
 */
export function computarEstado(
  agoraMin: number,
  fila: CheckIn[],
  turnos: TurnoHoje[],
  atendimentos: Atendimento[],
  preferenciais: PreferencialFuturo[],
  terapeutas: TerapeutaBola[],
  config: ConfigBola = CONFIG_PADRAO
): EstadoTerapeuta[] {
  const porId = new Map(terapeutas.map((t) => [t.id, t]));
  const turnoDe = new Map(turnos.map((t) => [t.terapeutaId, t]));

  return fila
    .filter((c) => porId.has(c.terapeutaId))
    .map((c) => {
      const terapeuta = porId.get(c.terapeutaId)!;
      const turno = turnoDe.get(c.terapeutaId) ?? null;
      const meus = atendimentosDe(c.terapeutaId, atendimentos);

      const concluidos = meus.filter((a) => a.fimMin <= agoraMin);
      const rodadas = concluidos.filter(
        (a) => a.fimMin - a.inicioMin > config.duracaoMantemVezMax
      ).length;

      let status: StatusBola;

      // fora do turno de hoje (não escalada) ou turno ainda não começou / já acabou
      if (!turno || agoraMin < turno.inicioMin || agoraMin >= turno.fimMin) {
        status = { tipo: "FORA_DE_TURNO" };
      } else {
        const atual = meus.find(
          (a) => a.inicioMin <= agoraMin && agoraMin < a.fimMin
        );
        if (atual) {
          status = {
            tipo: "EM_ATENDIMENTO",
            ateMin: atual.fimMin,
            cliente: atual.cliente,
            servico: atual.servico,
          };
        } else {
          const pref = proximoPreferencial(c.terapeutaId, agoraMin, preferenciais);
          if (pref && pref.inicioMin - agoraMin < config.reservaAntecedenciaMin) {
            status = {
              tipo: "RESERVADA",
              preferencialInicioMin: pref.inicioMin,
              cliente: pref.cliente,
            };
          } else {
            status = { tipo: "LIVRE" };
          }
        }
      }

      return {
        terapeuta,
        chegadaMin: c.chegadaMin,
        turnoFimMin: turno?.fimMin ?? null,
        rodadas,
        atendimentosTotais: concluidos.length,
        status,
      };
    });
}

export interface Candidata {
  terapeuta: TerapeutaBola;
  rodadas: number;
  chegadaMin: number;
  elegivel: boolean;
  motivo: string;
}

export interface ResultadoBola {
  escolhida: TerapeutaBola | null;
  salaBelle: string | null;
  motivo: string;
  ordem: Candidata[];
}

/**
 * Decide a PRÓXIMA terapeuta para um pedido, aplicando todas as regras.
 */
export function escolherProxima(
  agoraMin: number,
  estados: EstadoTerapeuta[],
  pedido: Pedido,
  preferenciais: PreferencialFuturo[]
): ResultadoBola {
  const candidatas: Candidata[] = estados
    .filter(
      (e) =>
        e.status.tipo !== "EM_ATENDIMENTO" && e.status.tipo !== "FORA_DE_TURNO"
    )
    .map((e) => {
      const base = {
        terapeuta: e.terapeuta,
        rodadas: e.rodadas,
        chegadaMin: e.chegadaMin,
      };

      if (e.terapeuta.servicos && !e.terapeuta.servicos.includes(pedido.servicoCod)) {
        return { ...base, elegivel: false, motivo: `não faz ${pedido.servicoNome}` };
      }
      if (pedido.generoPref && e.terapeuta.genero !== pedido.generoPref) {
        const lbl = pedido.generoPref === "M" ? "masculino" : "feminino";
        return { ...base, elegivel: false, motivo: `pedido é ${lbl}` };
      }
      // choca com o PRÓXIMO PREFERENCIAL dela? (só preferencial prende)
      const pref = proximoPreferencial(e.terapeuta.id, agoraMin, preferenciais);
      if (pref && agoraMin + pedido.duracaoMin > pref.inicioMin) {
        return {
          ...base,
          elegivel: false,
          motivo: `reservada p/ preferencial ${pref.cliente} às ${minToHHMM(pref.inicioMin)}`,
        };
      }
      // passa do fim do turno?
      if (e.turnoFimMin !== null && agoraMin + pedido.duracaoMin > e.turnoFimMin) {
        return {
          ...base,
          elegivel: false,
          motivo: `turno acaba ${minToHHMM(e.turnoFimMin)}`,
        };
      }
      return { ...base, elegivel: true, motivo: "" };
    });

  candidatas.sort((a, b) =>
    a.rodadas !== b.rodadas ? a.rodadas - b.rodadas : a.chegadaMin - b.chegadaMin
  );

  const escolhidaCand = candidatas.find((c) => c.elegivel) ?? null;
  if (escolhidaCand) {
    escolhidaCand.motivo = `1ª da bola que faz ${pedido.servicoNome}, disponível`;
  }

  return {
    escolhida: escolhidaCand?.terapeuta ?? null,
    salaBelle: pedido.salaNome ?? null,
    motivo: escolhidaCand
      ? `${escolhidaCand.terapeuta.nome} — ${escolhidaCand.rodadas} atend., chegou ${minToHHMM(escolhidaCand.chegadaMin)}`
      : "nenhuma terapeuta disponível para este pedido",
    ordem: candidatas,
  };
}
