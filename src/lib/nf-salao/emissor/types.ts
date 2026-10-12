// Conector de emissão de NFS-e — contrato estável, independente do backend.
// Hoje o backend é a API OFICIAL do padrão NACIONAL (SNNFS-e/Sefin/ADN). Amanhã pode
// ter um backend municipal (SP) p/ o Higienópolis (Lucro Presumido). O motor de cálculo
// e a tela NÃO conhecem o backend — só este contrato.

export type Ambiente = "homologacao" | "producao";

/** Dados de negócio p/ montar UMA DPS (Declaração de Prestação de Serviços) do salão. */
export interface DpsDados {
  ambiente: Ambiente;
  serie: string; // série da DPS (até 5 díg; ex. "1")
  numero: number; // nDPS — sequencial por CNPJ/série (é o "RPS" do padrão nacional)
  dhEmi: Date; // data/hora de emissão
  competencia: Date; // dCompet — início da prestação (1º dia do mês da competência)
  // Prestador (a empresa da unidade — o salão)
  prestadorCnpj: string; // só dígitos
  prestadorIM: string; // inscrição municipal
  prestadorRazaoSocial: string;
  prestadorEndereco: {
    logradouro: string; numero: string; complemento?: string; bairro: string;
    codMunicipioIbge: string; uf: string; cep: string; // cep só dígitos
  };
  // Regime (todas as 7 são Simples ME/EPP)
  opSimpNac: 1 | 2 | 3; // 1=Não optante, 2=MEI, 3=ME/EPP
  regApTribSN?: 1 | 2 | 3; // obrigatório só quando opSimpNac=3
  regEspTrib: number; // 0=Nenhum
  // Serviço
  codMunicipioPrestacaoIbge: string; // onde o serviço foi prestado
  cTribNac: string; // 6 dígitos (ex. "060301" massagem, "060201" estética)
  cNBS?: string; // ex. "126023000"
  descricaoServico: string; // discriminação (o mesmo texto que a tela já monta)
  // Valores
  valorServico: number; // M — valor total da NF do salão (R$)
  tribISSQN: 1 | 2 | 3 | 4; // 1=tributável
  tpRetISSQN: 1 | 2 | 3; // 1=não retido
  aliquotaIssPct?: number; // pAliq / alíquota ISS em % (ex.: 5 = 5%). Nacional: opcional. SP: usado.
  pTotTribSNPct?: number; // % tributos aprox. do Simples (totTrib quando opSimpNac=3)

  // ── Específico do padrão municipal de SP (Nota do Milhão) ───────────────────
  codigoServicoMunicipal?: string; // lista própria de SP, ex. "08516" (estética)
  tipoRps?: string; // "RPS" (default) | "RPS-M" | "RPS-C"
  statusRps?: string; // "N" (normal, default) | "C" (cancelado)
  tributacaoRps?: string; // "T" (tributado no município, default)
  issRetido?: boolean; // default false

  // ── Específico do padrão GINFES/ABRASF (São Bernardo - Metrópole) ───────────
  itemListaServico?: string; // ABRASF (item LC116), ex. "0602"
  codigoTributacaoMunicipio?: string; // código de tributação do município (SBC)
  optanteSimplesNacional?: 1 | 2; // 1=Sim, 2=Não (ABRASF)
  incentivadorCultural?: 1 | 2; // 1=Sim, 2=Não
  naturezaOperacao?: string; // "1" (tributação no município)
}

export interface EmitirResultado {
  ok: boolean;
  chaveAcesso?: string; // 50 dígitos (só padrão nacional)
  codVerificacao?: string | null; // código de verificação (SP / GINFES)
  idDps?: string;
  numeroNfse?: string | null; // nº da NFS-e emitida
  xmlNfse?: string | null; // NFS-e autorizada (já descompactada)
  dataAutorizacao?: string | null;
  erros?: { codigo: string; descricao: string; complemento?: string }[];
  httpStatus?: number;
  raw?: unknown; // resposta crua p/ auditoria/debug
}

export interface ConsultarResultado {
  ok: boolean;
  chaveAcesso: string;
  situacao?: string;
  numeroNfse?: string | null;
  xmlNfse?: string | null;
  erros?: { codigo: string; descricao: string; complemento?: string }[];
  httpStatus?: number;
  raw?: unknown;
}

/** Contrato do conector. Implementado por backend (oficial-nacional, futuramente municipal-sp). */
export interface EmissorNfse {
  readonly nome: string;
  emitir(dados: DpsDados, cred: CredencialCertificado): Promise<EmitirResultado>;
  consultar(chaveAcesso: string, cred: CredencialCertificado): Promise<ConsultarResultado>;
}

/** Certificado A1 (sensível). Carregado de fora do repo — ver config.ts. */
export interface CredencialCertificado {
  pfx: Buffer; // conteúdo do .pfx/.p12
  senha: string;
}
