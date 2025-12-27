import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Package, Loader2, Search, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw, TrendingUp, Box, DoorOpen, MoreVertical, X, Timer, Activity, BarChart3, History } from 'lucide-react'
import { useAuth } from '../src/contexts/AuthContext'

interface Porta { uid: string; numero_porta: number; status_atual: string; ocupado_em?: string; bloco_atual?: string; apartamento_atual?: string; gaveteiro_nome?: string; tempo_ocupado_minutos?: number }
interface Entrega { uid: string; bloco: string; apartamento: string; status: string; numero_porta?: number; tempo_ocupado_minutos?: number }
interface Stats { totalPortas: number; portasLivres: number; portasOcupadas: number; entregasPendentes: number; entregasSemana: number }
interface EstatPeriodo { periodo: string; total_ocupacoes: number; total_retiradas: number; total_cancelamentos: number }
interface RelatorioBloco { bloco: string; apartamento: string; total_entregas: number; total_retiradas: number; total_cancelamentos: number; total_pendentes: number }
interface Movimentacao { uid: string; acao: string; timestamp: string; bloco?: string; apartamento?: string; numero_porta?: number }
interface RelatorioPorta { total_ocupacoes: number; total_retiradas: number; total_cancelamentos: number; tempo_medio_ocupacao_minutos: number }

const formatTempo = (min: number) => { if (min < 60) return min + 'min'; const h = Math.floor(min / 60); if (h < 24) return h + 'h ' + (min % 60) + 'min'; return Math.floor(h / 24) + 'd ' + (h % 24) + 'h' }
const formatData = (d?: string) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

export default function GerenciarArmarioPage() {
  const { usuario, condominio, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [portas, setPortas] = useState<Porta[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [estatPeriodo, setEstatPeriodo] = useState<EstatPeriodo[]>([])
  const [relatorioBloco, setRelatorioBloco] = useState<RelatorioBloco[]>([])
  const [historico, setHistorico] = useState<Movimentacao[]>([])
  const [aba, setAba] = useState<'geral' | 'portas' | 'entregas' | 'relatorios' | 'historico'>('geral')
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [filtroPorta, setFiltroPorta] = useState('')
  const [filtroStatusPorta, setFiltroStatusPorta] = useState('')
  const [filtroEntrega, setFiltroEntrega] = useState('')
  const [filtroStatusEntrega, setFiltroStatusEntrega] = useState('')
  const [portaSel, setPortaSel] = useState<Porta | null>(null)
  const [relPorta, setRelPorta] = useState<RelatorioPorta | null>(null)
  const [loadingRel, setLoadingRel] = useState(false)
  const [entregaSel, setEntregaSel] = useState<Entrega | null>(null)
  const [processando, setProcessando] = useState(false)

  useEffect(() => { if (!authLoading && !usuario) router.push('/login') }, [usuario, authLoading, router])

  const carregarDados = useCallback(async () => {
    if (!condominio?.uid) return
    setLoading(true)
    try {
      const [p, e, s, ep, rb, h] = await Promise.all([
        fetch('/api/gerenciamento/portas?condominioUid=' + condominio.uid).then(r => r.ok ? r.json() : []),
        fetch('/api/gerenciamento/entregas?condominioUid=' + condominio.uid).then(r => r.ok ? r.json() : []),
        fetch('/api/gerenciamento/estatisticas?condominioUid=' + condominio.uid).then(r => r.ok ? r.json() : null),
        fetch('/api/gerenciamento/estatisticas-periodo?condominioUid=' + condominio.uid + '&periodo=' + periodo).then(r => r.ok ? r.json() : []),
        fetch('/api/gerenciamento/relatorio-bloco?condominioUid=' + condominio.uid).then(r => r.ok ? r.json() : []),
        fetch('/api/gerenciamento/historico?condominioUid=' + condominio.uid + '&limite=50').then(r => r.ok ? r.json() : [])
      ])
      setPortas(p); setEntregas(e); setStats(s); setEstatPeriodo(ep); setRelatorioBloco(rb); setHistorico(h)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [condominio?.uid, periodo])

  useEffect(() => { if (condominio?.uid) carregarDados() }, [condominio?.uid, carregarDados])

  const carregarRelPorta = async (uid: string) => { setLoadingRel(true); try { const r = await fetch('/api/gerenciamento/relatorio-porta?portaUid=' + uid); if (r.ok) setRelPorta(await r.json()) } catch (e) { console.error(e) } finally { setLoadingRel(false) } }
  const atualizarEntrega = async (uid: string, status: string) => { setProcessando(true); try { await fetch('/api/gerenciamento/entrega-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entregaUid: uid, novoStatus: status, usuarioUid: usuario?.uid }) }); setEntregaSel(null); carregarDados() } catch (e) { console.error(e) } finally { setProcessando(false) } }

  const portasFiltradas = portas.filter(p => { if (filtroStatusPorta === 'OCUPADO' && p.status_atual !== 'OCUPADO') return false; if (filtroStatusPorta === 'DISPONIVEL' && p.status_atual !== 'DISPONIVEL') return false; if (filtroStatusPorta === 'CRITICO' && !(p.status_atual === 'OCUPADO' && (p.tempo_ocupado_minutos || 0) > 1440)) return false; if (filtroPorta && !p.numero_porta.toString().includes(filtroPorta) && !p.bloco_atual?.toLowerCase().includes(filtroPorta.toLowerCase())) return false; return true })
  const entregasFiltradas = entregas.filter(e => { if (filtroStatusEntrega && e.status !== filtroStatusEntrega) return false; if (filtroEntrega && !e.bloco.toLowerCase().includes(filtroEntrega.toLowerCase()) && !e.apartamento.toLowerCase().includes(filtroEntrega.toLowerCase())) return false; return true })
  const criticas = portas.filter(p => p.status_atual === 'OCUPADO' && (p.tempo_ocupado_minutos || 0) > 1440).length

  if (authLoading || !usuario) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>

  return (
    <div>
      <Head><title>Gerenciar Armário | AIRE</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-white">
        <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center"><Box className="w-5 h-5 text-white" /></div>
              <div><h1 className="text-lg font-black text-slate-900">Gerenciar Armário</h1><p className="text-xs text-slate-500">{condominio?.nome}</p></div>
            </div>
            <div className="flex items-center gap-3">
              {criticas > 0 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 text-red-700 animate-pulse"><AlertTriangle className="w-4 h-4" /><span className="text-sm font-bold">{criticas} crítica{criticas > 1 ? 's' : ''}</span></div>}
              <button onClick={carregarDados} disabled={loading} className={"flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"}><RefreshCw className={"w-4 h-4 " + (loading ? "animate-spin" : "")} />Atualizar</button>
            </div>
          </div>
        </div>
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 flex gap-1 py-2 overflow-x-auto">
            <button onClick={() => setAba('geral')} className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap " + (aba === 'geral' ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-slate-100")}><Activity className="w-4 h-4" />Visão Geral</button>
            <button onClick={() => setAba('portas')} className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap " + (aba === 'portas' ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-slate-100")}><DoorOpen className="w-4 h-4" />Portas ({portas.length})</button>
            <button onClick={() => setAba('entregas')} className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap " + (aba === 'entregas' ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-slate-100")}><Package className="w-4 h-4" />Entregas ({entregas.length})</button>
            <button onClick={() => setAba('relatorios')} className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap " + (aba === 'relatorios' ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-slate-100")}><BarChart3 className="w-4 h-4" />Relatórios</button>
            <button onClick={() => setAba('historico')} className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap " + (aba === 'historico' ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-slate-100")}><History className="w-4 h-4" />Histórico</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          {aba === 'geral' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="rounded-2xl border-2 p-4 bg-slate-50 text-slate-600 border-slate-200"><p className="text-xs font-bold uppercase">Total Portas</p><p className="text-3xl font-black">{stats?.totalPortas || 0}</p></div>
                <div className="rounded-2xl border-2 p-4 bg-emerald-50 text-emerald-600 border-emerald-200"><p className="text-xs font-bold uppercase">Livres</p><p className="text-3xl font-black">{stats?.portasLivres || 0}</p></div>
                <div className="rounded-2xl border-2 p-4 bg-amber-50 text-amber-600 border-amber-200"><p className="text-xs font-bold uppercase">Ocupadas</p><p className="text-3xl font-black">{stats?.portasOcupadas || 0}</p></div>
                <div className="rounded-2xl border-2 p-4 bg-red-50 text-red-600 border-red-200"><p className="text-xs font-bold uppercase">Críticas (+24h)</p><p className="text-3xl font-black">{criticas}</p></div>
                <div className="rounded-2xl border-2 p-4 bg-blue-50 text-blue-600 border-blue-200"><p className="text-xs font-bold uppercase">Pendentes</p><p className="text-3xl font-black">{stats?.entregasPendentes || 0}</p></div>
                <div className="rounded-2xl border-2 p-4 bg-purple-50 text-blue-600 border-purple-200"><p className="text-xs font-bold uppercase">Semana</p><p className="text-3xl font-black">{stats?.entregasSemana || 0}</p></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border p-4">
                  <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-slate-700">Movimentação</h3>
                    <div className="flex gap-1">
                      <button onClick={() => setPeriodo('dia')} className={"px-3 py-1 rounded-lg text-xs font-bold " + (periodo === 'dia' ? "bg-sky-100 text-sky-700" : "text-slate-500")}>Diário</button>
                      <button onClick={() => setPeriodo('semana')} className={"px-3 py-1 rounded-lg text-xs font-bold " + (periodo === 'semana' ? "bg-sky-100 text-sky-700" : "text-slate-500")}>Semanal</button>
                      <button onClick={() => setPeriodo('mes')} className={"px-3 py-1 rounded-lg text-xs font-bold " + (periodo === 'mes' ? "bg-sky-100 text-sky-700" : "text-slate-500")}>Mensal</button>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 h-32">
                    {estatPeriodo.map((d, i) => {
                      const max = Math.max(...estatPeriodo.map(x => x.total_ocupacoes), 1)
                      return (<div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full flex flex-col gap-0.5" style={{height:'100px'}}><div className="w-full bg-emerald-400 rounded-t" style={{height:(d.total_retiradas/max)*100+'%'}} /><div className="w-full bg-amber-400" style={{height:((d.total_ocupacoes-d.total_retiradas-d.total_cancelamentos)/max)*100+'%'}} /><div className="w-full bg-red-400 rounded-b" style={{height:(d.total_cancelamentos/max)*100+'%'}} /></div><span className="text-[10px] text-slate-500">{d.periodo}</span></div>)
                    })}
                  </div>
                  <div className="flex justify-center gap-4 mt-3 text-xs"><div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-400" /><span>Retiradas</span></div><div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-400" /><span>Pendentes</span></div><div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-400" /><span>Canceladas</span></div></div>
                </div>
                <div className="bg-white rounded-2xl border p-4">
                  <div className="flex items-center gap-2 mb-4"><AlertTriangle className="w-5 h-5 text-red-500" /><h3 className="text-sm font-bold text-slate-700">Portas Ocupadas +24h</h3></div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {portas.filter(p => p.status_atual === 'OCUPADO' && (p.tempo_ocupado_minutos || 0) > 1440).sort((a, b) => (b.tempo_ocupado_minutos || 0) - (a.tempo_ocupado_minutos || 0)).map(p => (
                      <div key={p.uid} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200">
                        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><span className="text-lg font-black text-red-600">{p.numero_porta}</span></div><div><p className="text-sm font-bold text-slate-800">{p.bloco_atual} - {p.apartamento_atual}</p><p className="text-xs text-slate-500">{p.gaveteiro_nome}</p></div></div>
                        <p className="text-lg font-black text-red-600">{formatTempo(p.tempo_ocupado_minutos || 0)}</p>
                      </div>
                    ))}
                    {criticas === 0 && <div className="text-center py-8 text-slate-400"><CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhuma porta crítica</p></div>}
                  </div>
                </div>
              </div>
            </div>
          )}
          {aba === 'portas' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Buscar porta ou bloco..." value={filtroPorta} onChange={e => setFiltroPorta(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm" /></div>
                <select value={filtroStatusPorta} onChange={e => setFiltroStatusPorta(e.target.value)} className="px-4 py-2.5 rounded-xl border text-sm font-medium"><option value="">Todos</option><option value="DISPONIVEL">Livres</option><option value="OCUPADO">Ocupadas</option><option value="CRITICO">Críticas (+24h)</option></select>
              </div>
              {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div> : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
                  {portasFiltradas.map(p => {
                    const ocupada = p.status_atual === 'OCUPADO'
                    const critica = ocupada && (p.tempo_ocupado_minutos || 0) > 1440
                    const atencao = ocupada && (p.tempo_ocupado_minutos || 0) > 720 && !critica
                    let bg = 'bg-emerald-50 border-emerald-300', txt = 'text-emerald-600', label = 'LIVRE'
                    if (critica) { bg = 'bg-red-50 border-red-400 ring-2 ring-red-200'; txt = 'text-red-600'; label = 'CRÍTICO' }
                    else if (atencao) { bg = 'bg-orange-50 border-orange-400'; txt = 'text-orange-600'; label = 'ATENÇÃO' }
                    else if (ocupada) { bg = 'bg-amber-50 border-amber-300'; txt = 'text-amber-600'; label = 'OCUPADO' }
                    return (
                      <button key={p.uid} onClick={() => { setPortaSel(p); carregarRelPorta(p.uid) }} className={"relative rounded-xl border-2 p-3 transition-all hover:shadow-lg " + bg}>
                        {critica && <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-bounce"><AlertTriangle className="w-3 h-3 text-white" /></div>}
                        <div className="text-center">
                          <p className="text-2xl font-black text-slate-800">{p.numero_porta}</p>
                          <p className={"text-[10px] font-bold uppercase " + txt}>{label}</p>
                          {ocupada && p.bloco_atual && <p className="mt-1 text-[10px] text-slate-600 truncate">{p.bloco_atual} - {p.apartamento_atual}</p>}
                          {(p.tempo_ocupado_minutos || 0) > 0 && <div className={"mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold " + (critica ? "bg-red-100 text-red-700" : atencao ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700")}><Clock className="w-3 h-3" />{formatTempo(p.tempo_ocupado_minutos || 0)}</div>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {portasFiltradas.length === 0 && !loading && <div className="text-center py-12 text-slate-400"><DoorOpen className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhuma porta encontrada</p></div>}
            </div>
          )}
          {aba === 'entregas' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Buscar bloco ou apartamento..." value={filtroEntrega} onChange={e => setFiltroEntrega(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm" /></div>
                <select value={filtroStatusEntrega} onChange={e => setFiltroStatusEntrega(e.target.value)} className="px-4 py-2.5 rounded-xl border text-sm font-medium"><option value="">Todos</option><option value="PENDENTE">Pendente</option><option value="RETIRADO">Retirado</option><option value="CANCELADO">Cancelado</option></select>
              </div>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full"><thead className="bg-slate-50"><tr><th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Porta</th><th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Destino</th><th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Status</th><th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Tempo</th><th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Ações</th></tr></thead>
                <tbody className="divide-y">{entregasFiltradas.map(e => (<tr key={e.uid} className="hover:bg-slate-50"><td className="py-3 px-4"><div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-black">{e.numero_porta || '-'}</div></td><td className="py-3 px-4"><span className="font-bold">{e.bloco}</span> - <span className="font-bold">{e.apartamento}</span></td><td className="py-3 px-4"><span className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold " + (e.status === 'PENDENTE' ? "bg-amber-100 text-amber-700" : e.status === 'RETIRADO' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{e.status === 'PENDENTE' && <Clock className="w-3 h-3" />}{e.status === 'RETIRADO' && <CheckCircle2 className="w-3 h-3" />}{e.status === 'CANCELADO' && <XCircle className="w-3 h-3" />}{e.status}</span></td><td className="py-3 px-4">{(e.tempo_ocupado_minutos || 0) > 0 ? formatTempo(e.tempo_ocupado_minutos || 0) : '-'}</td><td className="py-3 px-4 text-right">{e.status === 'PENDENTE' && <button onClick={() => setEntregaSel(e)} className="p-2 rounded-lg hover:bg-slate-100"><MoreVertical className="w-4 h-4" /></button>}</td></tr>))}</tbody></table>
                {entregasFiltradas.length === 0 && <div className="text-center py-12 text-slate-400"><Package className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhuma entrega</p></div>}
              </div>
            </div>
          )}
          {aba === 'relatorios' && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="p-4 border-b"><h3 className="text-sm font-bold text-slate-700">Relatório por Bloco/Apartamento</h3></div>
              <table className="w-full"><thead className="bg-slate-50"><tr><th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Bloco</th><th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Apto</th><th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Total</th><th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Retiradas</th><th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Canceladas</th><th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Pendentes</th></tr></thead>
              <tbody className="divide-y">{relatorioBloco.map((r, i) => (<tr key={i} className="hover:bg-slate-50"><td className="py-3 px-4 font-bold">{r.bloco}</td><td className="py-3 px-4">{r.apartamento}</td><td className="py-3 px-4 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 font-bold">{r.total_entregas}</span></td><td className="py-3 px-4 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold">{r.total_retiradas}</span></td><td className="py-3 px-4 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-700 font-bold">{r.total_cancelamentos}</span></td><td className="py-3 px-4 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-700 font-bold">{r.total_pendentes}</span></td></tr>))}</tbody></table>
              {relatorioBloco.length === 0 && <div className="text-center py-12 text-slate-400"><BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhum dado</p></div>}
            </div>
          )}
          {aba === 'historico' && (
            <div className="bg-white rounded-2xl border overflow-hidden divide-y">
              {historico.map(m => (<div key={m.uid} className="flex items-center justify-between p-4 hover:bg-slate-50"><div className="flex items-center gap-4"><div className={"w-10 h-10 rounded-xl flex items-center justify-center " + (m.acao === 'OCUPAR' ? "bg-amber-100 text-amber-600" : m.acao === 'RETIRAR' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>{m.acao === 'OCUPAR' ? <Package className="w-5 h-5" /> : m.acao === 'RETIRAR' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}</div><div><p className="font-bold text-slate-800">{m.acao} - Porta {m.numero_porta || '?'}</p><p className="text-sm text-slate-500">{m.bloco && m.apartamento ? m.bloco + ' - ' + m.apartamento : '-'}</p></div></div><p className="text-sm text-slate-500">{formatData(m.timestamp)}</p></div>))}
              {historico.length === 0 && <div className="text-center py-12 text-slate-400"><History className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhuma movimentação</p></div>}
            </div>
          )}
        </div>
        {portaSel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center"><span className="text-2xl font-black text-white">{portaSel.numero_porta}</span></div><div><h3 className="text-xl font-bold text-white">Porta {portaSel.numero_porta}</h3><p className="text-white/80 text-sm">{portaSel.gaveteiro_nome}</p></div></div><button onClick={() => { setPortaSel(null); setRelPorta(null) }} className="text-white/80 hover:text-white"><X className="w-6 h-6" /></button></div></div>
              <div className="p-5 overflow-y-auto max-h-[60vh]">
                <div className={"rounded-xl p-4 mb-4 " + (portaSel.status_atual === 'OCUPADO' ? (portaSel.tempo_ocupado_minutos || 0) > 1440 ? "bg-red-50 border-2 border-red-200" : "bg-amber-50 border-2 border-amber-200" : "bg-emerald-50 border-2 border-emerald-200")}><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-slate-500">Status Atual</p><p className={"text-lg font-black " + (portaSel.status_atual === 'OCUPADO' ? (portaSel.tempo_ocupado_minutos || 0) > 1440 ? "text-red-600" : "text-amber-600" : "text-emerald-600")}>{portaSel.status_atual === 'OCUPADO' ? 'OCUPADA' : 'LIVRE'}</p></div>{portaSel.status_atual === 'OCUPADO' && (portaSel.tempo_ocupado_minutos || 0) > 0 && <div className="text-right"><p className="text-xs text-slate-500">Tempo ocupada</p><p className={"text-lg font-bold " + ((portaSel.tempo_ocupado_minutos || 0) > 1440 ? "text-red-600" : "text-amber-600")}>{formatTempo(portaSel.tempo_ocupado_minutos || 0)}</p></div>}</div>{portaSel.status_atual === 'OCUPADO' && portaSel.bloco_atual && <div className="mt-3 pt-3 border-t border-slate-200"><p className="text-sm text-slate-600"><span className="font-semibold">Destino:</span> {portaSel.bloco_atual} - Apto {portaSel.apartamento_atual}</p></div>}</div>
                {loadingRel ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-600" /></div> : relPorta && <div><h4 className="text-sm font-bold text-slate-700 mb-3">Estatísticas da Porta</h4><div className="grid grid-cols-3 gap-3 mb-4"><div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-2xl font-black text-slate-800">{relPorta.total_ocupacoes}</p><p className="text-[10px] font-bold text-slate-500 uppercase">Ocupações</p></div><div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-2xl font-black text-emerald-600">{relPorta.total_retiradas}</p><p className="text-[10px] font-bold text-slate-500 uppercase">Retiradas</p></div><div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-2xl font-black text-red-600">{relPorta.total_cancelamentos}</p><p className="text-[10px] font-bold text-slate-500 uppercase">Canceladas</p></div></div><div className="bg-sky-50 rounded-xl p-4"><div className="flex items-center gap-2 mb-2"><Timer className="w-4 h-4 text-sky-600" /><span className="text-sm font-bold text-sky-700">Tempo Médio de Ocupação</span></div><p className="text-2xl font-black text-sky-600">{relPorta.tempo_medio_ocupacao_minutos > 0 ? formatTempo(relPorta.tempo_medio_ocupacao_minutos) : 'Sem dados'}</p></div></div>}
              </div>
            </div>
          </div>
        )}
        {entregaSel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-5"><div className="flex items-center justify-between"><div><h3 className="text-xl font-bold text-white">Ações da Entrega</h3><p className="text-white/80 text-sm">Porta {entregaSel.numero_porta} - {entregaSel.bloco} / {entregaSel.apartamento}</p></div><button onClick={() => setEntregaSel(null)} className="text-white/80 hover:text-white"><X className="w-6 h-6" /></button></div></div>
              <div className="p-5 space-y-3">
                <button onClick={() => atualizarEntrega(entregaSel.uid, 'RETIRADO')} disabled={processando} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50">{processando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}Marcar como Retirado</button>
                <button onClick={() => atualizarEntrega(entregaSel.uid, 'CANCELADO')} disabled={processando} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100 disabled:opacity-50">{processando ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}Cancelar Entrega</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
