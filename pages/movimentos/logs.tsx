import Head from 'next/head'
import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Calendar, FileSpreadsheet, FileText, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { MainLayout } from '../../components/MainLayout'
import { useAuth } from '../../src/contexts/AuthContext'

type AnalyticsItem = {
  key: string
  label: string
  entradas: number
  saidas: number
  canceladas: number
  total: number
}

type AnalyticsResponse = {
  topPortas: AnalyticsItem[]
  topBlocosApartamentos: AnalyticsItem[]
}

export default function MovimentosLogsPage() {
  const router = useRouter()
  const { condominio } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [busca, setBusca] = useState('')

  const [data, setData] = useState<AnalyticsResponse>({ topPortas: [], topBlocosApartamentos: [] })

  const toIsoStart = (date: string) => {
    if (!date) return ''
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }

  const toIsoEnd = (date: string) => {
    if (!date) return ''
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
  }

  const toBrDate = (isoDate: string) => {
    if (!isoDate) return ''
    const [y, m, d] = isoDate.split('-')
    if (!y || !m || !d) return ''
    return `${d}/${m}/${y}`
  }

  const carregar = async () => {
    if (!condominio?.uid) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('condominioUid', condominio.uid)

      const fromIso = toIsoStart(dataInicio)
      const toIso = toIsoEnd(dataFim)
      if (fromIso) params.set('from', fromIso)
      if (toIso) params.set('to', toIso)

      const resp = await fetch(`/api/movimentacoes/analytics?${params.toString()}`)
      const json = (await resp.json().catch(() => null)) as (AnalyticsResponse & { error?: string; details?: string }) | null

      if (!resp.ok || !json) {
        const msg = (json as any)?.error || 'Erro ao carregar logs'
        const det = (json as any)?.details
        throw new Error(det ? `${msg}: ${det}` : msg)
      }

      setData({
        topPortas: Array.isArray(json.topPortas) ? json.topPortas : [],
        topBlocosApartamentos: Array.isArray(json.topBlocosApartamentos) ? json.topBlocosApartamentos : []
      })
    } catch (e: any) {
      console.error('Erro ao carregar analytics:', e)
      setError(e?.message || 'Erro ao carregar logs')
      setData({ topPortas: [], topBlocosApartamentos: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.uid, dataInicio, dataFim])

  const filtroBusca = useMemo(() => busca.trim().toLowerCase(), [busca])

  const topPortasFiltrado = useMemo(() => {
    if (!filtroBusca) return data.topPortas
    return data.topPortas.filter((i) => String(i.label || '').toLowerCase().includes(filtroBusca))
  }, [data.topPortas, filtroBusca])

  const topBlocosAptosFiltrado = useMemo(() => {
    if (!filtroBusca) return data.topBlocosApartamentos
    return data.topBlocosApartamentos.filter((i) => String(i.label || '').toLowerCase().includes(filtroBusca))
  }, [data.topBlocosApartamentos, filtroBusca])

  const baixarExcel = () => {
    const escape = (v: any) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const linhasPortas = topPortasFiltrado
      .map(
        (i) =>
          `<tr><td>PORTA</td><td>${escape(i.label)}</td><td>${i.entradas || 0}</td><td>${i.saidas || 0}</td><td>${i.canceladas || 0}</td><td>${i.total || 0}</td></tr>`
      )
      .join('')

    const linhasBlocoApto = topBlocosAptosFiltrado
      .map(
        (i) =>
          `<tr><td>BLOCO_APTO</td><td>${escape(i.label)}</td><td>${i.entradas || 0}</td><td>${i.saidas || 0}</td><td>${i.canceladas || 0}</td><td>${i.total || 0}</td></tr>`
      )
      .join('')

    const html =
      `<!doctype html><html><head><meta charset="utf-8" /></head><body>` +
      `<table border="1">` +
      `<thead><tr><th>tipo</th><th>label</th><th>entradas</th><th>saidas</th><th>canceladas</th><th>total</th></tr></thead>` +
      `<tbody>${linhasPortas}${linhasBlocoApto}</tbody>` +
      `</table>` +
      `</body></html>`

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const baixarPdf = async () => {
    const jspdfMod = await import('jspdf')
    const jsPDF = (jspdfMod as any).jsPDF || (jspdfMod as any).default

    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const marginX = 10
    const marginY = 12
    const rowH = 6

    const titulo = 'Relatório de Logs'
    const subtitulo = `${condominio?.nome || 'Condomínio'} · Ranking de entradas, saídas e canceladas`
    const geradoEm = new Date().toLocaleString('pt-BR')
    const periodo = dataInicio || dataFim ? `${dataInicio || '—'} até ${dataFim || '—'}` : 'Todos os períodos'

    let pageNum = 1

    const drawHeader = () => {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text(titulo, marginX, marginY)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(subtitulo, marginX, marginY + 6)
      pdf.text(`Período: ${periodo}`, marginX, marginY + 11)
      pdf.text(`Gerado em: ${geradoEm}`, marginX, marginY + 16)
      pdf.text(`Página: ${pageNum}`, pageWidth - marginX, marginY + 16, { align: 'right' })

      pdf.setDrawColor(220)
      pdf.line(marginX, marginY + 20, pageWidth - marginX, marginY + 20)
    }

    const ensureSpace = (nextY: number) => {
      if (nextY <= pageHeight - marginY) return
      pdf.addPage()
      pageNum += 1
      drawHeader()
      y = marginY + 28
    }

    const drawTable = (title: string, rows: Array<{ label: string; entradas: number; saidas: number; canceladas: number; total: number }>) => {
      ensureSpace(y + 10)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(title, marginX, y)
      y += 6

      const col1 = 90
      const colN = 22
      const cols = [
        { label: 'ITEM', w: col1 },
        { label: 'ENTRADAS', w: colN },
        { label: 'SAÍDAS', w: colN },
        { label: 'CANCEL', w: colN },
        { label: 'TOTAL', w: colN }
      ]

      pdf.setFontSize(9)
      let x = marginX
      pdf.setFont('helvetica', 'bold')
      for (const c of cols) {
        pdf.text(c.label, x + 1, y)
        x += c.w
      }
      y += 2
      pdf.setDrawColor(220)
      pdf.line(marginX, y, pageWidth - marginX, y)
      y += 4

      pdf.setFont('helvetica', 'normal')
      for (const r of rows) {
        ensureSpace(y + rowH)
        x = marginX
        pdf.text(String(r.label || '—'), x + 1, y, { maxWidth: col1 - 2 })
        x += col1
        pdf.text(String(r.entradas || 0), x + colN - 1, y, { align: 'right' })
        x += colN
        pdf.text(String(r.saidas || 0), x + colN - 1, y, { align: 'right' })
        x += colN
        pdf.text(String(r.canceladas || 0), x + colN - 1, y, { align: 'right' })
        x += colN
        pdf.text(String(r.total || 0), x + colN - 1, y, { align: 'right' })
        y += rowH
      }

      y += 4
    }

    let y = marginY + 28
    drawHeader()

    drawTable(
      'Top Portas',
      topPortasFiltrado.map((i) => ({
        label: i.label,
        entradas: i.entradas || 0,
        saidas: i.saidas || 0,
        canceladas: i.canceladas || 0,
        total: i.total || 0
      }))
    )

    drawTable(
      'Top Bloco/Apartamento',
      topBlocosAptosFiltrado.map((i) => ({
        label: i.label,
        entradas: i.entradas || 0,
        saidas: i.saidas || 0,
        canceladas: i.canceladas || 0,
        total: i.total || 0
      }))
    )

    pdf.save(`logs_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  if (!condominio) {
    return null
  }

  return (
    <MainLayout>
      <Head>
        <title>Logs e Analytics - Movimentos</title>
        <meta name="description" content="Análise de movimentos: portas e bloco/apartamento com mais entradas e saídas" />
      </Head>

      <div className="w-full" id="logs-report">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 overflow-visible">
          <div className="p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 flex-nowrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => router.push('/movimentos')}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex-shrink-0"
                    aria-label="Voltar"
                    title="Voltar"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">Logs</h1>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={baixarExcel}
                    className="shrink-0 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    title="Baixar Excel"
                    aria-label="Baixar Excel"
                  >
                    <FileSpreadsheet size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void baixarPdf()}
                    className="shrink-0 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                    title="Baixar PDF"
                    aria-label="Baixar PDF"
                  >
                    <FileText size={16} />
                  </button>
                </div>
              </div>

              <div className="text-sm text-slate-500 truncate">
                {condominio?.nome || 'Condomínio'} · Ranking de entradas e saídas
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100/70">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="relative min-w-0">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                <div className="flex items-center sm:justify-end">
                  <div className="w-full lg:w-auto grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="relative">
                      <div className="w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-slate-700">
                        <Calendar size={16} className="text-slate-500" />
                        <span className={dataInicio ? 'text-sm text-slate-800 font-semibold' : 'text-sm text-slate-400'}>
                          {dataInicio ? toBrDate(dataInicio) : 'dd/mm/aaaa'}
                        </span>
                        <span className="w-4" />
                      </div>
                      <input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Data início"
                      />
                    </div>

                    <span className="text-slate-300">—</span>

                    <div className="relative">
                      <div className="w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-slate-700">
                        <Calendar size={16} className="text-slate-500" />
                        <span className={dataFim ? 'text-sm text-slate-800 font-semibold' : 'text-sm text-slate-400'}>
                          {dataFim ? toBrDate(dataFim) : 'dd/mm/aaaa'}
                        </span>
                        <span className="w-4" />
                      </div>
                      <input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Data fim"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 overflow-visible">
          {error ? (
            <div className="p-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm font-semibold">{error}</div>
            </div>
          ) : null}

          {loading ? (
            <div className="p-6">
              <div className="text-sm text-slate-500">Carregando logs...</div>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Top Portas</div>
                    <div className="text-xs text-slate-500">Mais movimentos (entradas + saídas)</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200/60">
                      <tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="px-4 py-3">Porta</th>
                        <th className="px-4 py-3 text-right">Entradas</th>
                        <th className="px-4 py-3 text-right">Saídas</th>
                        <th className="px-4 py-3 text-right">Canceladas</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topPortasFiltrado.map((i) => (
                        <tr key={i.key} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-sm font-bold text-slate-900">{i.label}</td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-700 font-extrabold">{i.entradas}</td>
                          <td className="px-4 py-3 text-sm text-right text-rose-700 font-extrabold">{i.saidas}</td>
                          <td className="px-4 py-3 text-sm text-right text-amber-700 font-extrabold">{i.canceladas || 0}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-900 font-extrabold">{i.total}</td>
                        </tr>
                      ))}
                      {topPortasFiltrado.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                            Nenhum dado encontrado
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200/60 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Top Bloco/Apartamento</div>
                    <div className="text-xs text-slate-500">Mais movimentos (entradas + saídas)</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200/60">
                      <tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="px-4 py-3">Bloco · Apto</th>
                        <th className="px-4 py-3 text-right">Entradas</th>
                        <th className="px-4 py-3 text-right">Saídas</th>
                        <th className="px-4 py-3 text-right">Canceladas</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topBlocosAptosFiltrado.map((i) => (
                        <tr key={i.key} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-sm font-bold text-slate-900">{i.label}</td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-700 font-extrabold">{i.entradas}</td>
                          <td className="px-4 py-3 text-sm text-right text-rose-700 font-extrabold">{i.saidas}</td>
                          <td className="px-4 py-3 text-sm text-right text-amber-700 font-extrabold">{i.canceladas || 0}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-900 font-extrabold">{i.total}</td>
                        </tr>
                      ))}
                      {topBlocosAptosFiltrado.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                            Nenhum dado encontrado
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t border-slate-200/60">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold uppercase text-emerald-700">Entradas</div>
                          <div className="mt-1 text-lg font-black text-emerald-700">
                            {topBlocosAptosFiltrado.reduce((acc, i) => acc + (i.entradas || 0), 0)}
                          </div>
                        </div>
                        <TrendingUp size={18} className="text-emerald-700" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold uppercase text-rose-700">Saídas</div>
                          <div className="mt-1 text-lg font-black text-rose-700">
                            {topBlocosAptosFiltrado.reduce((acc, i) => acc + (i.saidas || 0), 0)}
                          </div>
                        </div>
                        <TrendingDown size={18} className="text-rose-700" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold uppercase text-amber-700">Canceladas</div>
                          <div className="mt-1 text-lg font-black text-amber-700">
                            {topBlocosAptosFiltrado.reduce((acc, i) => acc + (i.canceladas || 0), 0)}
                          </div>
                        </div>
                        <TrendingDown size={18} className="text-amber-700" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
