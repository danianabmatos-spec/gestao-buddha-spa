// Unidades atendidas pelo módulo NF Salão Parceiro. Fonte fixa (espelha o seed do
// banco: Unidade.id ↔ slug). id é usado no NfSalao* (banco); slug é usado pelo Belle,
// Reembolso e Folha. Manter em sincronia com prisma/seed e belle/unidades-config.
export interface UnidadeNf {
  id: number;
  slug: string;
  nome: string;
}

export const UNIDADES_NF: UnidadeNf[] = [
  { id: 1, slug: "shopping-metropole", nome: "Shopping Metrópole" },
  { id: 2, slug: "analia-franco", nome: "Anália Franco" },
  { id: 3, slug: "shopping-analia-franco", nome: "Shopping Anália Franco" },
  { id: 4, slug: "perdizes", nome: "Perdizes" },
  { id: 5, slug: "tatuape-gomescardim", nome: "Tatuapé Gomes Cardim" },
  { id: 6, slug: "mooca-plaza", nome: "Mooca Plaza" },
  { id: 7, slug: "higienopolis", nome: "Higienópolis" },
];

export const slugPorId = (id: number): string | null =>
  UNIDADES_NF.find((u) => u.id === id)?.slug ?? null;

export const idPorSlug = (slug: string): number | null =>
  UNIDADES_NF.find((u) => u.slug === slug)?.id ?? null;

export const nomePorId = (id: number): string | null =>
  UNIDADES_NF.find((u) => u.id === id)?.nome ?? null;
