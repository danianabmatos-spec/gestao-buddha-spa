'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, subMonths, addMonths, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw, CheckCircle2, Clock, AlertCircle, Zap, Hand, ChevronLeft, ChevronRight, Search, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VouchersResumo, Voucher } from '@/lib/wordpress/vouchers'

const WP_AFFILIATION = '894555'
const WP_URL = 'https://buddhaspa.com.br'

export default function VouchersPage() {
  const hoje = new Date()
  const [mesRef, setMesRef] = useState<Date>(hoje)
  const [dados, setDados] = useState<VouchersResumo | null>(null)
  const [dadosOmni, setDadosOmni] = useState<VouchersResumo | null>(null)
  const [dadosCortesia, setDadosCortesia] = useState<VouchersResumo | null>(null)
  const [syncRequired, setSyncRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [validando, setValidando] = useState<string | null>(null)
  const [feedbackValidacao, setFeedbackValidacao] = useState<{ codigo: string; ok: boolean; msg: string } | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    vouchers: true,
    omnichannel: false,
    cortesias: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const getPeriodo = (ref: Date) => ({
    ini: format(startOfMonth(ref), 'yyyy-MM-dd'),
    fim: format(
      ref.getMonth() === hoje.getMonth() && ref.getFullYear() === hoje.getFullYear()
        ? hoje
        : endOfMonth(ref),
      'yyyy-MM-dd'
    )
  })

  const buscar = useCallback(async (ref: Date) => {
    setLoading(true)
    setErro(null)
    const { ini, fim } = getPeriodo(ref)

    try {
      // Busca os 3 tipos separadamente
      const [respSite, respOmni, respCortesia] = await Promise.all([
        fetch(`/api/vouchers/get-by-type?tipo=site&dataIni=${ini}&dataFim=${fim}`),
        fetch(`/api/vouchers/get-by-type?tipo=omnichannel&dataIni=${ini}&dataFim=${fim}`),
        fetch(`/api/vouchers/get-by-type?tipo=cortesia&dataIni=${ini}&dataFim=${fim}`),
      ])

      const [dataSite, dataOmni, dataCortesia] = await Promise.all([
        respSite.json(),
        respOmni.json(),
        respCortesia.json(),
      ])

      setDados(dataSite)
      setDadosOmni(dataOmni)
      setDadosCortesia(dataCortesia)
      setSyncRequired(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  // Sincronização via browser relay — abre popup no WP admin, busca dados, envia para nosso servidor
  const sincronizar = useCallback(async (ref: Date) => {
    setSyncing(true)
    setErro(null)
    const { ini, fim } = getPeriodo(ref)

    const wpUrl = `${WP_URL}/wp-admin/admin.php?` + new URLSearchParams({
      page: 'vouchers', status: '', product_id: '0', category_id: '0',
      date_sell_start: '', date_sell_end: '',
      date_used_start: ini, date_used_end: fim,
      affilliation_id: WP_AFFILIATION,
    }).toString()

    try {
      // Abre janela do WP admin em segundo plano
      const popup = window.open(wpUrl, 'wp_vouchers_sync', 'width=1200,height=800,noopener=0')

      if (!popup) {
        setErro('Popup bloqueado. Por favor, permita popups para este site e tente novamente.')
        setSyncing(false)
        return
      }

      // Aguarda a página carregar
      await new Promise(resolve => setTimeout(resolve, 4000))

      // Injeta script de extração via postMessage (sem fetch cross-origin)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(popup as any).eval(`
          (async () => {
            try {
              const html = document.documentElement.innerHTML;

              // Extrai dados diretamente no browser (sem fetch cross-origin)
              const rows = [];
              let total = 0;
              const trPattern = /<tr>([\\s\\S]*?)<\\/tr>/g;
              let m;
              while ((m = trPattern.exec(html)) !== null) {
                const r = m[1];
                if (!r.includes('data-colname="Código"')) continue;
                const get = (col) => {
                  const x = r.match(new RegExp('data-colname="' + col + '"[^>]*>([\\\\s\\\\S]*?)<\\\\/td>'));
                  return x?.[1].replace(/<[^>]+>/g,'').replace(/\\s+/g,' ').trim() || '';
                };
                const codigo = get('Código');
                const produto = get('Nome').replace('Mostrar mais detalhes','').trim();
                const dataUso = get('Data da Utilização');
                const dataVenda = get('Data da Venda');
                const unidade = get('Unidade');
                const valor = get('Valor de Reembolso');
                const status = get('Status');
                const v = parseFloat(valor.replace('R$','').replace(/\\./g,'').replace(',','.').trim()) || 0;
                total += v;
                rows.push({ codigo, produto, dataUso, dataVenda, unidade, valor, valorReembolso: v, status });
              }

              // postMessage para o opener (localhost:3000) — sem fetch cross-origin!
              window.opener.postMessage({
                type: 'vouchers_sync_done',
                vouchers: rows,
                totalReembolso: total,
                totalValidados: rows.filter(r => r.status === 'Utilizado' || r.status === 'Validado').length,
              }, '*');
            } catch(e) {
              window.opener.postMessage({ type: 'vouchers_sync_error', error: e.message }, '*');
            } finally {
              setTimeout(() => window.close(), 1000);
            }
          })();
        `)
      } catch {
        popup.close()
        setErro('Sessão do WordPress expirada. Faça login em buddhaspa.com.br/wp-admin e tente novamente.')
        setSyncing(false)
        return
      }

      // Aguarda dados via postMessage e salva no servidor (timeout 20s)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { reject(new Error('Timeout na sincronização (20s)')) }, 20000)
        window.addEventListener('message', async function handler(e) {
          if (e.data?.type === 'vouchers_sync_done' || e.data?.type === 'vouchers_sync_error') {
            clearTimeout(timer)
            window.removeEventListener('message', handler)
            if (e.data.type === 'vouchers_sync_error') { reject(new Error(e.data.error)); return }
            // Salva os dados pré-extraídos no cache do servidor
            try {
              await fetch('/api/vouchers/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataIni: ini, dataFim: fim, ...e.data }),
              })
            } catch { /* falha silenciosa — dados ainda chegam via buscar() */ }
            resolve()
          }
        })
      })

      await buscar(ref)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na sincronização')
    } finally {
      setSyncing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar])

  useEffect(() => {
    buscar(mesRef)

    // Auto-refresh a cada 5 minutos
    const interval = setInterval(() => {
      buscar(mesRef)
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [mesRef, buscar])

  const validarVoucher = async (codigo: string) => {
    setValidando(codigo)
    setFeedbackValidacao(null)
    try {
      const resp = await fetch('/api/vouchers/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      })
      const json = await resp.json()
      setFeedbackValidacao({ codigo, ok: resp.ok, msg: json.message ?? (resp.ok ? 'Validado!' : 'Erro') })
      if (resp.ok) buscar(mesRef)
    } catch {
      setFeedbackValidacao({ codigo, ok: false, msg: 'Erro de rede' })
    } finally {
      setValidando(null)
    }
  }

  const mesLabel = format(mesRef, 'MMMM yyyy', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const vouchersFiltrados = dados?.vouchers.filter(v =>
    !filtro || v.codigo.toUpperCase().includes(filtro.toUpperCase()) ||
    v.produto.toLowerCase().includes(filtro.toLowerCase())
  ) ?? []

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-[#392617]">Vouchers Site</h1>
          <p className="text-xs text-muted-foreground">
            Shopping Metrópole · buddhaspa.com.br
            {syncedAt && <span className="ml-2 text-[#425F1D]">· Sync {new Date(syncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#F5F0EB] rounded-lg p-1">
          <button onClick={() => setMesRef(subMonths(mesRef, 1))} className="p-1.5 rounded hover:bg-[#DDC7A4]">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-sm font-semibold text-[#392617] min-w-[130px] text-center">{mesLabel}</span>
          <button onClick={() => setMesRef(addMonths(mesRef, 1))} className="p-1.5 rounded hover:bg-[#DDC7A4]">
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-5">
        {erro && (
          <div className="bg-[#D78B18]/8 border border-[#D78B18]/20 text-[#D78B18] rounded-lg px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Erro</p>
              <p className="text-xs mt-0.5">{erro}</p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (dados || dadosOmni || dadosCortesia) ? (
          <section>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Vouchers Site */}
              <div className="bg-white rounded-xl border-l-4 border-[#7E0000] shadow-sm p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vouchers Site</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-[#7E0000]">{fmt(dados?.totalReembolso || 0)}</p>
                  <span className="text-sm text-muted-foreground">({dados?.vouchers.length || 0})</span>
                </div>
              </div>

              {/* Validação Automática - Site */}
              <div className="bg-white rounded-xl border-l-4 border-[#425F1D] shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-[#425F1D]" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Validação Automática</p>
                </div>
                <p className="text-3xl font-bold text-[#425F1D] mt-1">{dados?.validacaoAutomatica || 0}</p>
              </div>

              {/* Validação Manual - Site */}
              <div className="bg-white rounded-xl border-l-4 border-[#392617] shadow-sm p-4">
                <div className="flex items-center gap-2">
                  <Hand size={16} className="text-[#392617]" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Validação Manual</p>
                </div>
                <p className="text-3xl font-bold text-[#392617] mt-1">{dados?.validacaoManual || 0}</p>
              </div>

              {/* Vouchers Omnichannel */}
              <div className="bg-white rounded-xl border-l-4 border-[#D78B18] shadow-sm p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vouchers Omnichannel</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-[#D78B18]">{fmt(dadosOmni?.totalReembolso || 0)}</p>
                  <span className="text-sm text-muted-foreground">({dadosOmni?.vouchers.length || 0})</span>
                </div>
              </div>

              {/* Vouchers Cortesia */}
              <div className="bg-white rounded-xl border-l-4 border-[#DDC7A4] shadow-sm p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vouchers Cortesia</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-[#DDC7A4]">{fmt(dadosCortesia?.totalValor || 0)}</p>
                  <span className="text-sm text-muted-foreground">({dadosCortesia?.vouchers.length || 0})</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {feedbackValidacao && (
          <div className={cn('rounded-lg px-4 py-3 text-sm flex items-center gap-2',
            feedbackValidacao.ok ? 'bg-[#425F1D]/8 text-[#425F1D] border border-[#425F1D]/20' : 'bg-[#7E0000]/8 text-[#7E0000] border border-[#7E0000]/20')}>
            {feedbackValidacao.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span><strong>{feedbackValidacao.codigo}</strong>: {feedbackValidacao.msg}</span>
          </div>
        )}

        {dados && (
          <>
          {/* Vouchers Site */}
          <section className="bg-white rounded-xl shadow-sm">
            <div className="p-4 md:p-5 flex items-center justify-between gap-4 border-b border-border">
              <button
                onClick={() => toggleSection('vouchers')}
                className="flex items-center gap-2 text-sm font-semibold text-[#7E0000] uppercase tracking-wide hover:opacity-70 transition-opacity"
              >
                <ChevronRight size={18} className={cn('transition-transform', expandedSections.vouchers && 'rotate-90')} />
                Vouchers Site ({vouchersFiltrados.length})
              </button>
              <div className="flex items-center gap-2 bg-[#F5F0EB] rounded-lg px-3 py-1.5">
                <Search size={14} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar código ou produto..."
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  className="bg-transparent text-sm outline-none w-48 placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {expandedSections.vouchers && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#F5F0EB]/50">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Data Utilização</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reembolso</th>
                    <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Validação</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchersFiltrados.map(v => (
                    <VoucherRow key={v.codigo} voucher={v} />
                  ))}
                  {vouchersFiltrados.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum voucher encontrado
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>

          {/* Vouchers Omnichannel */}
          <section className="bg-white rounded-xl shadow-sm">
            <div className="p-4 md:p-5 flex items-center justify-between gap-4 border-b border-border">
              <button
                onClick={() => toggleSection('omnichannel')}
                className="flex items-center gap-2 text-sm font-semibold text-[#425F1D] uppercase tracking-wide hover:opacity-70 transition-opacity"
              >
                <ChevronRight size={18} className={cn('transition-transform', expandedSections.omnichannel && 'rotate-90')} />
                Vouchers Omnichannel ({dadosOmni?.vouchers.length || 0})
              </button>
            </div>

            {expandedSections.omnichannel && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#F5F0EB]/50">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Data Venda</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Data Utilização</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Reembolso</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosOmni?.vouchers.map((v: any) => (
                    <tr key={v.codigo} className="border-b border-border/50 hover:bg-[#F5F0EB]/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#392617]">{v.codigo}</td>
                      <td className="py-2.5 px-4 text-sm text-[#392617] max-w-[300px] truncate">{v.produto}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground hidden md:table-cell">{v.dataVenda}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground hidden md:table-cell">{v.dataTerapia || '—'}</td>
                      <td className="py-2.5 px-4 text-right text-sm font-medium text-[#392617]">
                        R$ {v.valorReembolso?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {(!dadosOmni || dadosOmni.vouchers.length === 0) && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum voucher Omnichannel encontrado
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>

          {/* Vouchers Cortesia */}
          <section className="bg-white rounded-xl shadow-sm">
            <div className="p-4 md:p-5 flex items-center justify-between gap-4 border-b border-border">
              <button
                onClick={() => toggleSection('cortesias')}
                className="flex items-center gap-2 text-sm font-semibold text-[#D78B18] uppercase tracking-wide hover:opacity-70 transition-opacity"
              >
                <ChevronRight size={18} className={cn('transition-transform', expandedSections.cortesias && 'rotate-90')} />
                Vouchers Cortesia ({dadosCortesia?.vouchers.length || 0})
              </button>
            </div>

            {expandedSections.cortesias && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#F5F0EB]/50">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Data Criação</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Data Utilização</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosCortesia?.vouchers.map((v: any) => (
                    <tr key={v.codigo} className="border-b border-border/50 hover:bg-[#F5F0EB]/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#392617]">{v.codigo}</td>
                      <td className="py-2.5 px-4 text-sm text-[#392617] max-w-[300px] truncate">{v.produto}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground hidden md:table-cell">{v.dataCriacao}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground hidden md:table-cell">{v.dataTerapia}</td>
                      <td className="py-2.5 px-4 text-right text-sm font-medium text-[#392617]">
                        R$ {v.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {(!dadosCortesia || dadosCortesia.vouchers.length === 0) && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum voucher Cortesia encontrado
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </section>
          </>
        )}
      </main>
    </div>
  )
}

function KpiVoucher({ titulo, valor, icon: Icon, cor, destaque }: {
  titulo: string; valor: string; icon: React.ElementType; cor: string; destaque?: boolean
}) {
  const borders: Record<string, string> = { marsala: 'border-[#7E0000]', flora: 'border-[#425F1D]', dourado: 'border-[#D78B18]', neutro: 'border-[#DDC7A4]' }
  const icons: Record<string, string> = { marsala: 'bg-[#7E0000]/10 text-[#7E0000]', flora: 'bg-[#425F1D]/10 text-[#425F1D]', dourado: 'bg-[#D78B18]/10 text-[#D78B18]', neutro: 'bg-[#DDC7A4]/30 text-[#392617]' }
  return (
    <div className={cn('bg-white rounded-xl border-l-4 shadow-sm p-3 md:p-4', borders[cor] ?? 'border-[#DDC7A4]')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{titulo}</p>
          <p className={cn('font-bold mt-1 leading-none', destaque ? 'text-xl text-[#7E0000]' : 'text-2xl text-[#392617]')}>{valor}</p>
        </div>
        <div className={cn('p-2 rounded-lg', icons[cor] ?? '')}><Icon size={16} strokeWidth={1.8} /></div>
      </div>
    </div>
  )
}

function VoucherRow({ voucher: v }: { voucher: Voucher }) {
  return (
    <tr className="border-b border-border/50 hover:bg-[#F5F0EB]/40 transition-colors">
      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#392617]">{v.codigo}</td>
      <td className="py-2.5 px-4 text-sm text-[#392617] max-w-[200px] truncate">{v.produto}</td>
      <td className="py-2.5 px-4 text-xs text-muted-foreground hidden md:table-cell">{v.dataTerapia}</td>
      <td className="py-2.5 px-4 text-right text-sm font-medium text-[#392617]">{v.valorReembolso ? `R$ ${v.valorReembolso.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}</td>
      <td className="py-2.5 px-4 text-center">
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold',
          v.formaValidacao === 'Automatico' ? 'bg-[#425F1D]/12 text-[#425F1D]' :
          v.formaValidacao === 'Manualmente' ? 'bg-[#425F1D]/12 text-[#425F1D]' :
          'bg-[#392617]/12 text-[#392617]')}>
          {v.formaValidacao === 'Automatico' ? '⚡ Automático' :
           v.formaValidacao === 'Manualmente' ? '✋ Manual' :
           '⏳ Pendente'}
        </span>
      </td>
    </tr>
  )
}
