import { useEffect, useState } from 'react'
import { FileSpreadsheet, Download, Clock, Package, DoorOpen, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

interface DestinatarioJSON {
  bloco: string
  apartamento: string
}

interface Movimentacao {
  uid: string
  porta_uid: string
  numero_porta: number
  gaveteiro_nome: string
  tipo_acao: string
  status_resultante: string
  bloco: string
  apartamento: string
  destinatarios?: DestinatarioJSON[] // Novo campo JSON
  created_at: string
  tempo_ocupado_minutos?: number
}

interface Metricas {
  ocupadasHoje: number
  ocupadasSemana: number
  ocupadasMes: number
  ocupadasTotal: number
  liberadasHoje: number
  liberadasSemana: number
  liberadasMes: number
  liberadasTotal: number
  tempoMedioMinutos: number
}

const formatarTempo = (min: number): string => {
  if (!min || min <= 0) return '-'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return `${h}h ${m}min`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

// Formata destinatários (prioriza JSON, fallback para campos texto)
const formatarDestinatarios = (mov: Movimentacao): string => {
  // Se tem campo JSON, usa ele
  if (mov.destinatarios && mov.destinatarios.length > 0) {
    const grupos: Record<string, string[]> = {}
    
    for (const dest of mov.destinatarios) {
      const b = dest.bloco || '-'
      const a = dest.apartamento || ''
      if (!grupos[b]) grupos[b] = []
      if (a && !grupos[b].includes(a)) grupos[b].push(a)
    }
    
    return Object.entries(grupos)
      .map(([b, apts]) => apts.length === 1 ? `${b} - ${apts[0]}` : `${b}: ${apts.join(', ')}`)
      .join(' | ')
  }
  
  // Fallback: usa campos texto (bloco/apartamento)
  const bloco = mov.bloco || ''
  const apartamento = mov.apartamento || ''
  
  if (!bloco && !apartamento) return '-'
  if (!bloco) return apartamento
  if (!apartamento) return bloco
  
  // Verifica se tem múltiplos valores (separados por vírgula)
  const blocos = bloco.split(',').map(b => b.trim()).filter(Boolean)
  const aptos = apartamento.split(',').map(a => a.trim()).filter(Boolean)
  
  // Se não tem múltiplos, retorna simples
  if (blocos.length <= 1 && aptos.length <= 1) {
    return `${bloco} - ${apartamento}`
  }
  
  // Agrupa apartamentos por bloco
  const grupos: Record<string, string[]> = {}
  
  for (let i = 0; i < Math.max(blocos.length, aptos.length); i++) {
    const b = blocos[i] || blocos[blocos.length - 1] || ''
    const a = aptos[i] || ''
    if (b && a) {
      if (!grupos[b]) grupos[b] = []
      if (!grupos[b].includes(a)) grupos[b].push(a)
    }
  }
  
  return Object.entries(grupos)
    .map(([b, apts]) => apts.length === 1 ? `${b} - ${apts[0]}` : `${b}: ${apts.join(', ')}`)
    .join(' | ')
}

export default function RelatorioGaveteiros() {
  const { condominio } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [metricas, setMetricas] = useState<Metricas>({
    ocupadasHoje: 0, ocupadasSemana: 0, ocupadasMes: 0, ocupadasTotal: 0,
    liberadasHoje: 0, liberadasSemana: 0, liberadasMes: 0, liberadasTotal: 0,
    tempoMedioMinutos: 0
  })
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS')
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('TOTAL')

  useEffect(() => {
    if (condominio?.uid) carregarDados()
  }, [condominio?.uid])

  const carregarDados = async () => {
    if (!condominio?.uid) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('gvt_movimentacoes_porta')
        .select(`uid, porta_uid, tipo_acao, status_resultante, bloco, apartamento, destinatarios, created_at,
          porta:gvt_portas(numero_porta, gaveteiro:gvt_gaveteiros(nome))`)
        .eq('condominio_uid', condominio.uid)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error

      const movs: Movimentacao[] = (data || []).map(m => ({
        uid: m.uid, porta_uid: m.porta_uid,
        numero_porta: (m.porta as any)?.numero_porta || 0,
        gaveteiro_nome: (m.porta as any)?.gaveteiro?.nome || '',
        tipo_acao: m.tipo_acao, status_resultante: m.status_resultante,
        bloco: m.bloco || '', apartamento: m.apartamento || '',
        destinatarios: m.destinatarios || undefined, // Campo JSON
        created_at: m.created_at
      }))

      // Calcular tempo de ocupação
      movs.forEach(mov => {
        if (mov.tipo_acao === 'LIBERAR') {
          const ocup = movs.find(m => m.porta_uid === mov.porta_uid && m.tipo_acao === 'OCUPAR' && new Date(m.created_at) < new Date(mov.created_at))
          if (ocup) mov.tempo_ocupado_minutos = Math.floor((new Date(mov.created_at).getTime() - new Date(ocup.created_at).getTime()) / 60000)
        }
      })

      setMovimentacoes(movs)
      calcularMetricas(movs)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  const calcularMetricas = (movs: Movimentacao[]) => {
    const agora = new Date()
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
    const semana = new Date(hoje); semana.setDate(semana.getDate() - 7)
    const mes = new Date(agora.getFullYear(), agora.getMonth(), 1)

    const ocupacoes = movs.filter(m => m.tipo_acao === 'OCUPAR')
    const liberacoes = movs.filter(m => m.tipo_acao === 'LIBERAR')
    const libComTempo = liberacoes.filter(m => m.tempo_ocupado_minutos && m.tempo_ocupado_minutos > 0)
    const tempoMedio = libComTempo.length > 0 ? Math.floor(libComTempo.reduce((a, m) => a + (m.tempo_ocupado_minutos || 0), 0) / libComTempo.length) : 0

    setMetricas({
      ocupadasHoje: ocupacoes.filter(m => new Date(m.created_at) >= hoje).length,
      ocupadasSemana: ocupacoes.filter(m => new Date(m.created_at) >= semana).length,
      ocupadasMes: ocupacoes.filter(m => new Date(m.created_at) >= mes).length,
      ocupadasTotal: ocupacoes.length,
      liberadasHoje: liberacoes.filter(m => new Date(m.created_at) >= hoje).length,
      liberadasSemana: liberacoes.filter(m => new Date(m.created_at) >= semana).length,
      liberadasMes: liberacoes.filter(m => new Date(m.created_at) >= mes).length,
      liberadasTotal: liberacoes.length,
      tempoMedioMinutos: tempoMedio
    })
  }

  const movsFiltradas = movimentacoes.filter(m => {
    if (filtroTipo !== 'TODOS' && m.tipo_acao !== filtroTipo) return false
    const data = new Date(m.created_at)
    const agora = new Date()
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
    const semana = new Date(hoje); semana.setDate(semana.getDate() - 7)
    const mes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    if (filtroPeriodo === 'HOJE' && data < hoje) return false
    if (filtroPeriodo === 'SEMANA' && data < semana) return false
    if (filtroPeriodo === 'MES' && data < mes) return false
    return true
  })

  const exportarExcel = () => {
    const headers = ['Data/Hora', 'Gaveteiro', 'Porta', 'Tipo', 'Bloco', 'Apartamento', 'Tempo (min)', 'Tempo Formatado']
    const rows = movsFiltradas.map(m => [
      new Date(m.created_at).toLocaleString('pt-BR'), m.gaveteiro_nome, m.numero_porta,
      m.tipo_acao === 'OCUPAR' ? 'Ocupação' : 'Liberação', m.bloco, m.apartamento,
      m.tempo_ocupado_minutos || '', m.tempo_ocupado_minutos ? formatarTempo(m.tempo_ocupado_minutos) : ''
    ])
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio_gaveteiros_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (!condominio) return <div className="p-4 text-center text-gray-500">Carregando...</div>

  return (
    <div className="space-y-4">
      {/* Header Responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-blue-600 flex-shrink-0" />
              <span className="truncate">Relatório</span>
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm">Movimentações e estatísticas</p>
          </div>
        </div>
        <button onClick={exportarExcel} className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow text-sm">
          <Download size={16} />
          <span>Excel</span>
        </button>
      </div>

      {/* Cards de Métricas - Grid Responsivo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        {/* Ocupações */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Package size={16} className="sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Ocupações</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center">
            <div><p className="text-lg sm:text-xl font-bold">{metricas.ocupadasHoje}</p><p className="text-[10px] sm:text-xs opacity-75">Hoje</p></div>
            <div><p className="text-lg sm:text-xl font-bold">{metricas.ocupadasSemana}</p><p className="text-[10px] sm:text-xs opacity-75">Semana</p></div>
            <div className="hidden sm:block"><p className="text-xl font-bold">{metricas.ocupadasMes}</p><p className="text-xs opacity-75">Mês</p></div>
            <div className="hidden sm:block"><p className="text-xl font-bold">{metricas.ocupadasTotal}</p><p className="text-xs opacity-75">Total</p></div>
          </div>
          <div className="flex sm:hidden justify-between mt-1 text-[10px] opacity-75">
            <span>Mês: {metricas.ocupadasMes}</span>
            <span>Total: {metricas.ocupadasTotal}</span>
          </div>
        </div>
        
        {/* Liberações */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <DoorOpen size={16} className="sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Liberações</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center">
            <div><p className="text-lg sm:text-xl font-bold">{metricas.liberadasHoje}</p><p className="text-[10px] sm:text-xs opacity-75">Hoje</p></div>
            <div><p className="text-lg sm:text-xl font-bold">{metricas.liberadasSemana}</p><p className="text-[10px] sm:text-xs opacity-75">Semana</p></div>
            <div className="hidden sm:block"><p className="text-xl font-bold">{metricas.liberadasMes}</p><p className="text-xs opacity-75">Mês</p></div>
            <div className="hidden sm:block"><p className="text-xl font-bold">{metricas.liberadasTotal}</p><p className="text-xs opacity-75">Total</p></div>
          </div>
          <div className="flex sm:hidden justify-between mt-1 text-[10px] opacity-75">
            <span>Mês: {metricas.liberadasMes}</span>
            <span>Total: {metricas.liberadasTotal}</span>
          </div>
        </div>
        
        {/* Tempo Médio */}
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={16} className="sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Tempo Médio</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-center">{formatarTempo(metricas.tempoMedioMinutos)}</p>
          <p className="text-[10px] sm:text-xs text-center opacity-75">até liberação</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center bg-white p-2 sm:p-3 rounded-xl shadow">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-2 py-1.5 border rounded-lg text-xs sm:text-sm flex-1 sm:flex-none">
          <option value="TODOS">Todos</option>
          <option value="OCUPAR">Ocupações</option>
          <option value="LIBERAR">Liberações</option>
        </select>
        <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} className="px-2 py-1.5 border rounded-lg text-xs sm:text-sm flex-1 sm:flex-none">
          <option value="TOTAL">Total</option>
          <option value="HOJE">Hoje</option>
          <option value="SEMANA">Semana</option>
          <option value="MES">Mês</option>
        </select>
        <span className="text-xs text-gray-500 w-full sm:w-auto sm:ml-auto text-center sm:text-right">{movsFiltradas.length} registros</span>
      </div>

      {/* Lista de Movimentações */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : movsFiltradas.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum registro encontrado</div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="sm:hidden divide-y">
              {movsFiltradas.map(m => (
                <div key={m.uid} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.tipo_acao === 'OCUPAR' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {m.tipo_acao === 'OCUPAR' ? 'Ocupação' : 'Liberação'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(m.created_at).toLocaleDateString('pt-BR')} {new Date(m.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="font-bold text-blue-600 flex-shrink-0">P{m.numero_porta}</span>
                      <span className="text-gray-600 text-sm break-words">{formatarDestinatarios(m)}</span>
                    </div>
                    {m.tempo_ocupado_minutos && (
                      <span className="text-xs font-medium text-gray-500 flex-shrink-0">{formatarTempo(m.tempo_ocupado_minutos)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs">Data/Hora</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs">Porta</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs">Tipo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs">Localização</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 text-xs">Tempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movsFiltradas.map(m => (
                    <tr key={m.uid} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-center font-bold">{m.numero_porta}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${m.tipo_acao === 'OCUPAR' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {m.tipo_acao === 'OCUPAR' ? 'Ocup.' : 'Liber.'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs max-w-xs">{formatarDestinatarios(m)}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium">{m.tempo_ocupado_minutos ? formatarTempo(m.tempo_ocupado_minutos) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
