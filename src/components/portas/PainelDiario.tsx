import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { BarChart3, Calendar, FileSpreadsheet, FileText, Search, X, ArrowLeft, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import type { MovimentacaoPorta } from '../../types/gaveteiro'
import { useAuth } from '../../contexts/AuthContext'

type MovimentacaoRelatorio = MovimentacaoPorta & {
  cancelado?: boolean
  destinatarios?: any
  destinatarios_resumo?: any
}

type MovimentacoesResponse = {
  items: MovimentacaoRelatorio[]
  total: number
  page: number
  limit: number
  resumo: {
    entradas: number
    saidas: number
    canceladas: number
  }
}

export default function PainelMovimentos() {
  const router = useRouter()
  const { condominio } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<MovimentacaoRelatorio[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [resumo, setResumo] = useState({ entradas: 0, saidas: 0, canceladas: 0 })

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mostrarFiltrosData, setMostrarFiltrosData] = useState(false)

  const [busca, setBusca] = useState('')
  const [acao, setAcao] = useState('')
  const [origem, setOrigem] = useState('')
  const [bloco, setBloco] = useState('')
  const [apartamento, setApartamento] = useState('')
  const [numeroPorta, setNumeroPorta] = useState('')
  const [compartilhada, setCompartilhada] = useState('')
  const [cancelado, setCancelado] = useState('')

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((total || 0) / (limit || 1)))
  }, [total, limit])

  const periodoDescricao = useMemo(() => {
    if (!dataInicio && !dataFim) return 'Todos os períodos'
    if (dataInicio && !dataFim) return `A partir de ${dataInicio}`
    if (!dataInicio && dataFim) return `Até ${dataFim}`
    return `${dataInicio} até ${dataFim}`
  }, [dataInicio, dataFim])

  const limparFiltros = () => {
    setDataInicio('')
    setDataFim('')
    setBusca('')
    setAcao('')
    setOrigem('')
    setBloco('')
    setApartamento('')
    setNumeroPorta('')
    setCompartilhada('')
    setCancelado('')
    setPage(1)
    setMostrarFiltrosData(false)
  }

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

  const baixarExcel = () => {
    if (!condominio?.uid) return

    const params = new URLSearchParams()
    params.set('condominioUid', condominio.uid)

    const fromIso = toIsoStart(dataInicio)
    const toIso = toIsoEnd(dataFim)
    if (fromIso) params.set('from', fromIso)
    if (toIso) params.set('to', toIso)

    if (acao) params.set('acao', acao)
    if (origem) params.set('origem', origem)
    if (bloco) params.set('bloco', bloco)
    if (apartamento) params.set('apartamento', apartamento)
    if (numeroPorta) params.set('numeroPorta', numeroPorta)
    if (compartilhada) params.set('compartilhada', compartilhada)
    if (cancelado) params.set('cancelado', cancelado)
    if (busca) params.set('busca', busca)

    window.location.href = `/api/movimentacoes/export-excel?${params.toString()}`
  }

  const baixarPdf = async () => {
    if (!condominio?.uid) return

    const jspdfMod = await import('jspdf')
    const jsPDF = (jspdfMod as any).jsPDF || (jspdfMod as any).default

    const params = new URLSearchParams()
    params.set('condominioUid', condominio.uid)
    params.set('limit', '10000')
    params.set('page', '1')

    const fromIso = toIsoStart(dataInicio)
    const toIso = toIsoEnd(dataFim)
    if (fromIso) params.set('from', fromIso)
    if (toIso) params.set('to', toIso)

    if (acao) params.set('acao', acao)
    if (origem) params.set('origem', origem)
    if (bloco) params.set('bloco', bloco)
    if (apartamento) params.set('apartamento', apartamento)
    if (numeroPorta) params.set('numeroPorta', numeroPorta)
    if (compartilhada) params.set('compartilhada', compartilhada)
    if (cancelado) params.set('cancelado', cancelado)
    if (busca) params.set('busca', busca)

    const resp = await fetch(`/api/movimentacoes?${params.toString()}`)
    const data = (await resp.json().catch(() => null)) as (MovimentacoesResponse & { error?: string; details?: string }) | null
    if (!resp.ok || !data) {
      const msg = (data as any)?.error || 'Erro ao gerar PDF'
      const det = (data as any)?.details
      throw new Error(det ? `${msg}: ${det}` : msg)
    }

    const pdf = new jsPDF('l', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const marginX = 10
    const marginY = 10
    const headerGap = 6

    const titulo = 'Relatório de Movimentos'
    const subtitulo = `${condominio?.nome || 'Condomínio'} · ${periodoDescricao}`
    const geradoEm = new Date().toLocaleString('pt-BR')

    const filtros: string[] = []
    if (acao) filtros.push(`Ação: ${acao}`)
    if (origem) filtros.push(`Origem: ${origem}`)
    if (bloco) filtros.push(`Bloco: ${bloco}`)
    if (apartamento) filtros.push(`Apto: ${apartamento}`)
    if (numeroPorta) filtros.push(`Porta: ${numeroPorta}`)
    if (compartilhada) filtros.push(`Compartilhada: ${compartilhada}`)
    if (cancelado) filtros.push(`Cancelado: ${cancelado}`)
    if (busca) filtros.push(`Busca: ${busca}`)

    const drawHeader = (pageNum: number) => {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text(titulo, marginX, marginY)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(subtitulo, marginX, marginY + 6)
      pdf.text(`Gerado em: ${geradoEm}`, marginX, marginY + 11)
      pdf.text(`Página: ${pageNum}`, pageWidth - marginX, marginY + 11, { align: 'right' })

      if (filtros.length) {
        pdf.setFontSize(9)
        const filtroTxt = filtros.join(' | ')
        pdf.text(filtroTxt, marginX, marginY + 16, { maxWidth: pageWidth - marginX * 2 })
      }

      pdf.setDrawColor(220)
      pdf.line(marginX, marginY + 20, pageWidth - marginX, marginY + 20)
    }

    const columns = [
      { key: 'data', label: 'DATA/HORA', w: 30 },
      { key: 'porta', label: 'PORTA', w: 14 },
      { key: 'acao', label: 'AÇÃO', w: 26 },
      { key: 'status', label: 'STATUS', w: 26 },
      { key: 'origem', label: 'ORIGEM', w: 22 },
      { key: 'bloco', label: 'BLOCO', w: 20 },
      { key: 'apto', label: 'APTO', w: 18 },
      { key: 'cancel', label: 'CANCEL', w: 16 },
      { key: 'obs', label: 'OBSERVAÇÃO', w: 0 }
    ]

    const fixedWidth = columns.reduce((acc, c) => acc + (c.w || 0), 0)
    const available = pageWidth - marginX * 2
    const obsWidth = Math.max(30, available - fixedWidth)
    columns[columns.length - 1].w = obsWidth

    const rowH = 6
    const startY = marginY + (filtros.length ? 26 : 23)

    let pageNum = 1
    drawHeader(pageNum)

    let y = startY
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    let x = marginX
    for (const c of columns) {
      pdf.text(c.label, x + 1, y)
      x += c.w
    }
    y += 2
    pdf.setDrawColor(220)
    pdf.line(marginX, y, pageWidth - marginX, y)
    y += 4

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    const itemsArr = Array.isArray(data.items) ? data.items : []
    for (const m of itemsArr) {
      if (y > pageHeight - marginY) {
        pdf.addPage()
        pageNum += 1
        drawHeader(pageNum)
        y = startY

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        x = marginX
        for (const c of columns) {
          pdf.text(c.label, x + 1, y)
          x += c.w
        }
        y += 2
        pdf.setDrawColor(220)
        pdf.line(marginX, y, pageWidth - marginX, y)
        y += 4
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
      }

      const portaNum = (m as any)?.numero_porta
      const row = {
        data: formatarDataHora(m.timestamp),
        porta: typeof portaNum === 'number' ? String(portaNum) : '—',
        acao: acaoLabel(m.acao),
        status: m.status_resultante || '—',
        origem: m.origem || '—',
        bloco: m.bloco || '—',
        apto: m.apartamento || '—',
        cancel: (m as any)?.cancelado ? 'SIM' : String((m as any)?.acao || '').toLowerCase() === 'cancelado' ? 'SIM' : 'NÃO',
        obs: m.observacao || ''
      }

      x = marginX
      for (const c of columns) {
        const val = (row as any)[c.key]
        const text = String(val ?? '')
        pdf.text(text, x + 1, y, { maxWidth: c.w - 2 })
        x += c.w
      }
      y += rowH
    }

    pdf.save(`movimentos_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const carregar = async () => {
    if (!condominio?.uid) return

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('condominioUid', condominio.uid)
      params.set('limit', String(limit))
      params.set('page', String(page))

      const fromIso = toIsoStart(dataInicio)
      const toIso = toIsoEnd(dataFim)
      if (fromIso) params.set('from', fromIso)
      if (toIso) params.set('to', toIso)

      if (acao) params.set('acao', acao)
      if (origem) params.set('origem', origem)
      if (bloco) params.set('bloco', bloco)
      if (apartamento) params.set('apartamento', apartamento)
      if (numeroPorta) params.set('numeroPorta', numeroPorta)
      if (compartilhada) params.set('compartilhada', compartilhada)
      if (cancelado) params.set('cancelado', cancelado)
      if (busca) params.set('busca', busca)

      const resp = await fetch(`/api/movimentacoes?${params.toString()}`)
      const data = (await resp.json().catch(() => null)) as (MovimentacoesResponse & { error?: string; details?: string }) | null
      if (!resp.ok || !data) {
        const msg = (data as any)?.error || 'Erro ao carregar relatório'
        const det = (data as any)?.details
        throw new Error(det ? `${msg}: ${det}` : msg)
      }

      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)

      const resumoApi = data.resumo
      const entradasApi = typeof resumoApi?.entradas === 'number' ? resumoApi.entradas : 0
      const saidasApi = typeof resumoApi?.saidas === 'number' ? resumoApi.saidas : 0
      const canceladasApi = typeof resumoApi?.canceladas === 'number' ? resumoApi.canceladas : 0

      const itemsArr = Array.isArray(data.items) ? data.items : []
      const resumoLocal = itemsArr.reduce(
        (acc, m) => {
          const a = String((m as any)?.acao || '').toLowerCase()
          if (a === 'ocupar' || a === 'entrada' || a === 'ocupado') acc.entradas += 1
          if (a === 'retirada' || a === 'saida' || a === 'saída') acc.saidas += 1
          if (a === 'cancelar' || a === 'cancelado') acc.canceladas += 1
          return acc
        },
        { entradas: 0, saidas: 0, canceladas: 0 }
      )

      const algumResumoApi = entradasApi > 0 || saidasApi > 0 || canceladasApi > 0
      setResumo(algumResumoApi ? { entradas: entradasApi, saidas: saidasApi, canceladas: canceladasApi } : resumoLocal)
    } catch (e: any) {
      console.error('Erro ao carregar movimentos:', e)
      setError(e?.message || 'Erro ao carregar relatório')
      setItems([])
      setTotal(0)
      setResumo({ entradas: 0, saidas: 0, canceladas: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!condominio?.uid) return
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.uid])

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    condominio?.uid,
    page,
    limit,
    dataInicio,
    dataFim,
    busca,
    acao,
    origem,
    bloco,
    apartamento,
    numeroPorta,
    compartilhada,
    cancelado
  ])

  const formatarDataHora = (value?: string) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const acaoLabel = (a?: string) => {
    if (!a) return '—'
    const norm = String(a).toUpperCase()
    switch (norm) {
      case 'OCUPAR':
        return 'Entrada'
      case 'RETIRADA':
        return 'Saída'
      case 'CANCELAR':
        return 'Cancelamento'
      case 'CANCELADO':
        return 'Cancelamento'
      case 'ENTRADA':
        return 'Entrada'
      case 'SAIDA':
        return 'Saída'
      case 'SAÍDA':
        return 'Saída'
      case 'LIBERAR':
        return 'Liberação'
      case 'BAIXAR':
        return 'Baixa'
      default:
        return a
    }
  }

  const acaoNorm = useMemo(() => String(acao || '').toUpperCase().trim(), [acao])

  return (
    <div className="w-full" id="movimentos-report">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 overflow-visible">
        <div className="p-4 border-b border-gray-100/70">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex-shrink-0"
                aria-label="Voltar"
                title="Voltar"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">Movimentos</h1>
                <div className="mt-0.5 text-sm text-slate-500 truncate">{condominio?.nome || 'Condomínio'} · {periodoDescricao}</div>
              </div>
            </div>

            <div className="flex flex-nowrap items-center gap-2 w-full lg:w-auto">
              <div className="relative min-w-0 flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Buscar (bloco, apto, morador, observação...)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400
                           focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={() => router.push('/movimentos/logs')}
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white text-slate-700 border border-gray-200 hover:bg-slate-50 transition-colors"
                title="Logs"
                aria-label="Logs"
              >
                <BarChart3 size={16} />
              </button>

              <button
                type="button"
                onClick={baixarExcel}
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="Baixar Excel"
                aria-label="Baixar Excel"
              >
                <FileSpreadsheet size={16} />
              </button>

              <button
                type="button"
                onClick={() => void baixarPdf()}
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                title="Baixar PDF"
                aria-label="Baixar PDF"
              >
                <FileText size={16} />
              </button>

              <button
                type="button"
                onClick={() => setMostrarFiltrosData(!mostrarFiltrosData)}
                className={`shrink-0 px-4 py-2.5 rounded-xl font-semibold transition-all border shadow-sm ${
                  mostrarFiltrosData || dataInicio || dataFim || acao || origem || bloco || apartamento || numeroPorta || compartilhada || cancelado
                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white border-transparent'
                    : 'bg-white text-slate-700 border-gray-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  Filtros
                </div>
              </button>

              {(dataInicio || dataFim || busca || acao || origem || bloco || apartamento || numeroPorta || compartilhada || cancelado) && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent transition-colors shrink-0"
                  title="Limpar filtros"
                  aria-label="Limpar filtros"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {mostrarFiltrosData ? (
          <div className="p-4 border-b border-gray-100/70 bg-slate-50/60">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Data início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Data fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Tipo</label>
                <select
                  value={acao}
                  onChange={(e) => {
                    setAcao(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                >
                  <option value="">Todos</option>
                  <option value="OCUPAR">Entrada (OCUPAR)</option>
                  <option value="RETIRADA">Saída (RETIRADA)</option>
                  <option value="LIBERAR">Liberação (LIBERAR)</option>
                  <option value="BAIXAR">Baixa (BAIXAR)</option>
                  <option value="CANCELAR">Cancelamento (CANCELAR)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Origem</label>
                <input
                  value={origem}
                  onChange={(e) => {
                    setOrigem(e.target.value)
                    setPage(1)
                  }}
                  placeholder="WEB, ESP, ..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Bloco</label>
                <input
                  value={bloco}
                  onChange={(e) => {
                    setBloco(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Ex: A"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Apartamento</label>
                <input
                  value={apartamento}
                  onChange={(e) => {
                    setApartamento(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Ex: 101"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Número da porta</label>
                <input
                  value={numeroPorta}
                  onChange={(e) => {
                    setNumeroPorta(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Ex: 9"
                  inputMode="numeric"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Compartilhada</label>
                <select
                  value={compartilhada}
                  onChange={(e) => {
                    setCompartilhada(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                >
                  <option value="">Todas</option>
                  <option value="true">Somente compartilhadas</option>
                  <option value="false">Somente exclusivas</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Cancelado</label>
                <select
                  value={cancelado}
                  onChange={(e) => {
                    setCancelado(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                >
                  <option value="">Todos</option>
                  <option value="true">Somente cancelados</option>
                  <option value="false">Somente não cancelados</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Itens por página</label>
                <select
                  value={String(limit)}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    setLimit(Number.isNaN(n) ? 25 : n)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setAcao('')
            setPage(1)
          }}
          className={`rounded-2xl border bg-slate-50 p-4 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
            !acaoNorm ? 'border-sky-200 ring-1 ring-sky-200/60' : 'border-slate-200'
          }`}
          aria-pressed={!acaoNorm}
          title="Ver todas as movimentações"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-slate-700">Total</div>
              <div className="mt-1 text-3xl font-black text-slate-800">{total || 0}</div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-200/70 flex items-center justify-center text-slate-700">
              <Search size={18} />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setAcao('OCUPAR')
            setPage(1)
          }}
          className={`rounded-2xl border bg-emerald-50 p-4 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
            acaoNorm === 'OCUPAR' || acaoNorm === 'ENTRADA' ? 'border-emerald-300 ring-1 ring-emerald-200/70' : 'border-emerald-100'
          }`}
          aria-pressed={acaoNorm === 'OCUPAR' || acaoNorm === 'ENTRADA'}
          title="Filtrar por entradas"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-emerald-700">Entradas</div>
              <div className="mt-1 text-3xl font-black text-emerald-700">{resumo.entradas || 0}</div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <TrendingUp size={18} />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setAcao('RETIRADA')
            setPage(1)
          }}
          className={`rounded-2xl border bg-rose-50 p-4 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
            acaoNorm === 'RETIRADA' || acaoNorm === 'SAIDA' || acaoNorm === 'SAÍDA'
              ? 'border-rose-300 ring-1 ring-rose-200/70'
              : 'border-rose-100'
          }`}
          aria-pressed={acaoNorm === 'RETIRADA' || acaoNorm === 'SAIDA' || acaoNorm === 'SAÍDA'}
          title="Filtrar por saídas"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-rose-700">Saídas</div>
              <div className="mt-1 text-3xl font-black text-rose-700">{resumo.saidas || 0}</div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
              <TrendingDown size={18} />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setAcao('CANCELAR')
            setPage(1)
          }}
          className={`rounded-2xl border bg-amber-50 p-4 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
            acaoNorm === 'CANCELAR' || acaoNorm === 'CANCELADO' ? 'border-amber-300 ring-1 ring-amber-200/70' : 'border-amber-100'
          }`}
          aria-pressed={acaoNorm === 'CANCELAR' || acaoNorm === 'CANCELADO'}
          title="Filtrar por canceladas"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-amber-700">Canceladas</div>
              <div className="mt-1 text-3xl font-black text-amber-700">{resumo.canceladas || 0}</div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle size={18} />
            </div>
          </div>
        </button>
      </div>

      <div className="mt-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-600">
            Total: <span className="font-extrabold text-slate-900">{total}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-5">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded" />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-5">
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
              <div className="font-extrabold">Erro ao carregar</div>
              <div className="mt-1 text-sm">{error}</div>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum movimento encontrado</h3>
            <p className="text-sm text-gray-500">Ajuste os filtros e tente novamente</p>
          </div>
        ) : (
          <>
            <div className="md:hidden p-4">
              <div className="space-y-3">
                {items.map((m) => {
                  const portaNum = (m as any)?.numero_porta
                  const dest = (m as any)?.destinatarios_resumo
                  const blocoVal = m.bloco || (Array.isArray(dest) ? dest.map((d: any) => d?.bloco).filter(Boolean).join(', ') : '')
                  const aptVal = m.apartamento || (Array.isArray(dest) ? dest.map((d: any) => d?.apartamento).filter(Boolean).join(', ') : '')

                  return (
                    <div key={m.uid} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-500">{formatarDataHora(m.timestamp)}</div>
                          <div className="mt-1 text-sm font-extrabold text-slate-900">{acaoLabel(m.acao)}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">Status:</span> {m.status_resultante || '—'}
                          </div>
                          <div className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">Origem:</span> {m.origem || '—'}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-extrabold">
                            {typeof portaNum === 'number' ? portaNum : '—'}
                          </div>
                        </div>
                      </div>

                      {blocoVal || aptVal ? (
                        <div className="mt-3 text-xs">
                          <div className="font-bold text-slate-900 truncate">{blocoVal || '—'}</div>
                          <div className="text-slate-500 truncate">{aptVal || '—'}</div>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.cancelado ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Cancelado</span>
                        ) : null}
                        {m.compartilhada ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">Compartilhada</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Exclusiva</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-slate-50 border-b border-gray-100">
                  <tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 sm:px-6 py-4 font-medium w-[140px]">Data/Hora</th>
                    <th className="px-4 sm:px-6 py-4 font-medium w-[76px]">Porta</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Ação</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Status</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Origem</th>
                    <th className="hidden lg:table-cell px-4 sm:px-6 py-4 font-medium">Destinatário</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((m) => {
                    const portaNum = (m as any)?.numero_porta
                    const dest = (m as any)?.destinatarios_resumo
                    const blocoVal = m.bloco || (Array.isArray(dest) ? dest.map((d: any) => d?.bloco).filter(Boolean).join(', ') : '')
                    const aptVal = m.apartamento || (Array.isArray(dest) ? dest.map((d: any) => d?.apartamento).filter(Boolean).join(', ') : '')
                    return (
                      <tr key={m.uid} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 sm:px-6 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">{formatarDataHora(m.timestamp)}</td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-extrabold">
                            {typeof portaNum === 'number' ? portaNum : '—'}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-sm font-bold text-slate-800">{acaoLabel(m.acao)}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-700">{m.status_resultante || '—'}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-700">{m.origem || '—'}</td>
                        <td className="hidden lg:table-cell px-4 sm:px-6 py-4">
                          {blocoVal || aptVal ? (
                            <div className="text-sm">
                              <div className="font-bold text-slate-900">{blocoVal || '—'}</div>
                              <div className="text-slate-500">{aptVal || '—'}</div>
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400 italic">Sem destinatário</div>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {m.cancelado ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Cancelado</span>
                            ) : null}
                            {m.compartilhada ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">Compartilhada</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Exclusiva</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && items.length > 0 ? (
          <div className="p-4 border-t border-gray-100/70 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              Anterior
            </button>
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700">
              {page} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              Próxima
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
