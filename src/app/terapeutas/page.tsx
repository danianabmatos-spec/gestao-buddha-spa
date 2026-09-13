import { TerapeutasView } from '@/components/terapeutas/terapeutas-view'

export default function TerapeutasPage() {
  return (
    <div className="min-h-screen bg-[#E4E5E2] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#7E0000] mb-2">Terapeutas</h1>
          <p className="text-[#392617]/70">Performance dos terapeutas ativos — Produtividade, Fidelização e NPS</p>
        </div>
        <TerapeutasView unidadeSlug="shopping-metropole" />
      </div>
    </div>
  )
}
