import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { LayoutGrid, Clock, X, AlertCircle, Search, Building2, CheckCircle, XCircle, Users, FileSpreadsheet, RefreshCw } from 'lucide-react'
import type { Gaveteiro } from '../types/gaveteiro'
import { listarGaveteiros, listarPortas, listarPortasOcupadas, buscarPorBlocoApartamento, listarBlocos, listarApartamentos, type PortaOcupadaRelatorio, type MovimentacaoBlocoApartamento } from '../services/gaveteiroService'
import type { Bloco, Apartamento } from '../types/gaveteiro'
import { useAuth } from '../contexts/AuthContext'
import GaveteiroCompacto from '../components/gaveteiro/GaveteiroCompacto'

// Formata tempo em minutos para exibição legível - SEPARADO
function formatarTempo(minutos: number): string {
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  const mins = minutos % 60
  if (horas < 24) return `${horas}h ${mins}min`
  
  const dias = Math.floor(minutos / 1440)
  const horasRestantes = Math.floor((minutos % 1440) / 60)
  
  // 🎨 Formato separado para dias
  if (dias === 1 && horasRestantes === 0) return '1 dia'
  if (dias === 1) return `1 dia ${horasRestantes}h`
  if (horasRestantes === 0) return `${dias} dias`
  return `${dias}d ${horasRestantes}h`
}

// Retorna cor baseada no tempo de ocupação - CORES MAIS DISCRETAS
function getCorTempo(minutos: number): string {
  const dias = Math.floor(minutos / 1440)
  
  if (minutos < 60) return 'text-green-600 bg-green-50' // < 1h
  if (minutos < 240) return 'text-yellow-600 bg-yellow-50' // < 4h
  if (minutos < 1440) return 'text-orange-600 bg-orange-50' // < 24h
  
  // 🎨 CORES MAIS DISCRETAS PARA DIAS
  if (dias === 1) return 'text-amber-700 bg-amber-50' // 1 dia
  if (dias === 2) return 'text-orange-700 bg-orange-50' // 2 dias
  if (dias === 3) return 'text-red-700 bg-red-50' // 3 dias
  if (dias === 4) return 'text-red-800 bg-red-100' // 4 dias
  if (dias === 5) return 'text-stone-700 bg-stone-50' // 5 dias
  if (dias === 6) return 'text-stone-800 bg-stone-100' // 6 dias
  return 'text-stone-900 bg-stone-200' // 7+ dias (cinza escuro)
}

// Formatar destinatários agrupando por bloco
function formatarDestinatarios(bloco?: string, apartamento?: string): { bloco: string, apartamentos: string[] }[] {
  if (!bloco || !apartamento) return []
  
  const blocos = bloco.split(', ')
  const apartamentos = apartamento.split(', ')
  
  const grupos: Record<string, string[]> = {}
  
  blocos.forEach((b, index) => {
    const apto = apartamentos[index] || ''
    if (!grupos[b]) grupos[b] = []
    if (apto && !grupos[b].includes(apto)) {
      grupos[b].push(apto)
    }
  })
  
  return Object.entries(grupos).map(([b, apts]) => ({
    bloco: b,
    apartamentos: apts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }))
}

// Exibe todos os gaveteiros em formato de grid

export default function GaveteirosDashboard() {
  const { condominio } = useAuth()
  const router = useRouter()

  // Estados principais
  const [gaveteiros, setGaveteiros] = useState<Gaveteiro[]>([])
  const [showRelatorio, setShowRelatorio] = useState(false)
  const [portasOcupadas, setPortasOcupadas] = useState<PortaOcupadaRelatorio[]>([])
  const [loadingRelatorio, setLoadingRelatorio] = useState(false)
  
  // Estados para busca por bloco/apartamento
  const [showBusca, setShowBusca] = useState(false)
  const [buscaBloco, setBuscaBloco] = useState('')
  const [buscaApartamento, setBuscaApartamento] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<MovimentacaoBlocoApartamento[]>([])
  const [loadingBusca, setLoadingBusca] = useState(false)
  const [blocosDisponiveis, setBlocosDisponiveis] = useState<Bloco[]>([])
  const [apartamentosDisponiveis, setApartamentosDisponiveis] = useState<Apartamento[]>([])

  // Loading states
  const [loadingGaveteiros, setLoadingGaveteiros] = useState(false)
  
  // Totais para resumo
  const [totais, setTotais] = useState({ gaveteiros: 0, livres: 0, ocupadas: 0 })

  // Carregar gaveteiros do condomínio do usuário e ordenar pelo menor número de porta
  useEffect(() => {
    if (!condominio?.uid) {
      setGaveteiros([])
      return
    }

    const carregarEOrdenarGaveteiros = async () => {
      setLoadingGaveteiros(true)

      try {
        const gavs = await listarGaveteiros(condominio.uid)
        
        // Buscar portas de cada gaveteiro para ordenar e calcular totais
        let totalLivres = 0
        let totalOcupadas = 0
        
        const gavsComOrdem = await Promise.all(
          gavs.map(async (g) => {
            const portasDoGav = await listarPortas(g.uid)
            const menorNumero = portasDoGav.length > 0 
              ? Math.min(...portasDoGav.map(p => p.numero_porta))
              : 999999
            
            // Contar totais
            totalLivres += portasDoGav.filter(p => p.status_atual === 'DISPONIVEL').length
            totalOcupadas += portasDoGav.filter(p => p.status_atual === 'OCUPADO').length
            
            return { ...g, _ordem: menorNumero }
          })
        )
        
        // Ordenar pelo menor número de porta
        gavsComOrdem.sort((a, b) => a._ordem - b._ordem)
        
        setGaveteiros(gavsComOrdem)
        setTotais({ gaveteiros: gavs.length, livres: totalLivres, ocupadas: totalOcupadas })
      } catch (err) {
        console.error('Erro ao carregar gaveteiros:', err)
      } finally {
        setLoadingGaveteiros(false)
      }
    }

    carregarEOrdenarGaveteiros()
  }, [condominio?.uid])

  // Carregar relatório de portas ocupadas
  const carregarRelatorio = async () => {
    if (!condominio?.uid) return
    setLoadingRelatorio(true)
    try {
      const portas = await listarPortasOcupadas(condominio.uid)
      setPortasOcupadas(portas)
      setShowRelatorio(true)
    } catch (err) {
      console.error('Erro ao carregar relatório:', err)
    } finally {
      setLoadingRelatorio(false)
    }
  }

  // Carregar blocos quando abrir o modal
  const carregarBlocos = async () => {
    if (!condominio?.uid) return
    try {
      const blocos = await listarBlocos(condominio.uid)
      setBlocosDisponiveis(blocos)
    } catch (err) {
      console.error('Erro ao carregar blocos:', err)
    }
  }

  // Carregar apartamentos quando selecionar um bloco
  const selecionarBloco = async (blocoUid: string) => {
    const bloco = blocosDisponiveis.find(b => b.uid === blocoUid)
    setBuscaBloco(bloco?.nome || '')
    setBuscaApartamento('')
    setApartamentosDisponiveis([])
    setResultadosBusca([])
    
    if (blocoUid && condominio?.uid) {
      try {
        const aptos = await listarApartamentos(condominio.uid, blocoUid)
        setApartamentosDisponiveis(aptos)
      } catch (err) {
        console.error('Erro ao carregar apartamentos:', err)
      }
    }
  }

  // Buscar por bloco/apartamento (só ocupados)
  const executarBusca = async () => {
    if (!condominio?.uid) return
    if (!buscaBloco && !buscaApartamento) return
    
    setLoadingBusca(true)
    try {
      const resultados = await buscarPorBlocoApartamento(condominio.uid, buscaBloco, buscaApartamento)
      // Filtrar apenas os que ainda estão ocupados
      const ocupados = resultados.filter(r => r.status_resultante === 'OCUPADO')
      setResultadosBusca(ocupados)
    } catch (err) {
      console.error('Erro ao buscar:', err)
    } finally {
      setLoadingBusca(false)
    }
  }

  const abrirBusca = async () => {
    setBuscaBloco('')
    setBuscaApartamento('')
    setResultadosBusca([])
    setApartamentosDisponiveis([])
    setShowBusca(true)
    await carregarBlocos()
  }

  if (!condominio) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Carregando...</p>
      </div>
    )
  }

  // Referência ao container de ações no menu
  const navActionsContainer = document.getElementById('nav-actions')

  return (
    <div className="space-y-6">
      {/* Botões de Ação - Portal para o menu de navegação */}
      {navActionsContainer && createPortal(
        <>
          <button
            onClick={abrirBusca}
            className="p-1.5 sm:p-2 bg-gradient-to-r from-blue-500 to-indigo-500 
                     text-white rounded-lg shadow hover:shadow-lg hover:scale-105 transition-all"
            title="Buscar por Bloco/Apartamento"
          >
            <Search size={16} className="sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={carregarRelatorio}
            disabled={loadingRelatorio}
            className="p-1.5 sm:p-2 bg-gradient-to-r from-orange-500 to-red-500 
                     text-white rounded-lg shadow hover:shadow-lg hover:scale-105 transition-all
                     disabled:opacity-50"
            title="Tempo de Ocupação"
          >
            <Clock size={16} className="sm:w-5 sm:h-5" />
          </button>
        </>,
        navActionsContainer
      )}

      {/* Modal Busca por Bloco/Apartamento */}
      {showBusca && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header Elegante */}
            <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-6">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjLTIgMC00IDItNCAyczItNCA0LTRjMiAwIDQgMiA0IDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
              <button
                onClick={() => setShowBusca(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-all text-white/80 hover:text-white hover:scale-110"
              >
                <X size={20} />
              </button>
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                  <Search size={28} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Buscar Entregas</h2>
                  <p className="text-sm text-white/70">Localize portas ocupadas por bloco/apartamento</p>
                </div>
              </div>
            </div>

            {/* Filtros Elegantes */}
            <div className="p-5 bg-gradient-to-b from-gray-50 to-white border-b">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bloco</label>
                  <select
                    value={blocosDisponiveis.find(b => b.nome === buscaBloco)?.uid || ''}
                    onChange={(e) => selecionarBloco(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium bg-white 
                             focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
                             shadow-sm hover:border-gray-300"
                  >
                    <option value="">Selecione o Bloco</option>
                    {blocosDisponiveis.map(bloco => (
                      <option key={bloco.uid} value={bloco.uid}>
                        {bloco.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Apartamento</label>
                  <select
                    value={buscaApartamento}
                    onChange={(e) => setBuscaApartamento(e.target.value)}
                    disabled={!buscaBloco}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium bg-white 
                             focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all
                             shadow-sm hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Todos os apartamentos</option>
                    {apartamentosDisponiveis.map(apto => (
                      <option key={apto.uid} value={apto.numero}>
                        {apto.numero}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={executarBusca}
                    disabled={loadingBusca || !buscaBloco}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold
                             hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed 
                             flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:scale-[1.02]"
                  >
                    <Search size={18} />
                    {loadingBusca ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Resultados */}
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
              {resultadosBusca.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Search size={36} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">
                    {buscaBloco 
                      ? 'Nenhuma porta ocupada encontrada' 
                      : 'Selecione um bloco para buscar'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {buscaBloco ? 'Tente outro bloco ou apartamento' : 'Use os filtros acima para iniciar'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {resultadosBusca.map((mov) => {
                    const destinatarios = formatarDestinatarios(mov.bloco, mov.apartamento)
                    
                    return (
                      <div
                        key={mov.uid}
                        className="rounded-xl border-2 border-orange-200 bg-orange-50/50 overflow-hidden transition-all hover:shadow-md"
                      >
                        {/* Header do card */}
                        <div className="flex items-center justify-between px-4 py-3 bg-orange-100">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white bg-orange-500 text-lg">
                              {mov.numero_porta}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-lg">{mov.gaveteiro_nome}</p>
                              <p className="text-sm text-gray-500">{mov.gaveteiro_codigo}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {mov.compartilhada && (
                              <span className="px-3 py-1.5 bg-purple-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                                <Users size={14} />
                                Compartilhada
                              </span>
                            )}
                            <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-orange-500 text-white">
                              ⏳ Pendente
                            </span>
                          </div>
                        </div>
                        
                        {/* Destinatários */}
                        <div className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {destinatarios.map((grupo, idx) => (
                              <div key={idx} className="bg-white rounded-lg px-3 py-2 border shadow-sm">
                                <span className="text-xs text-gray-500 font-medium">{grupo.bloco}</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {grupo.apartamentos.map((apto, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                      {apto}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            📅 {new Date(mov.timestamp).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer Elegante */}
            <div className="p-4 border-t bg-white flex justify-between items-center">
              <p className="text-sm text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {resultadosBusca.length} resultado(s) encontrado(s)
              </p>
              <button
                onClick={() => setShowBusca(false)}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 
                         transition-all hover:scale-[1.02]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatório de Ocupação */}
      {showRelatorio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-orange-500 to-red-500 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <Clock size={24} />
                <div>
                  <h2 className="text-lg font-bold">Tempo de Ocupação</h2>
                  <p className="text-sm text-orange-100">{portasOcupadas.length} porta(s) ocupada(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={carregarRelatorio}
                  disabled={loadingRelatorio}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                  title="Atualizar"
                >
                  <RefreshCw size={18} className={loadingRelatorio ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setShowRelatorio(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Legenda com cores mais discretas */}
            <div className="px-4 py-2 bg-gray-50 border-b flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> &lt; 1h</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500"></span> 1-4h</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500"></span> 4-24h</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600"></span> 1 dia</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-600"></span> 2 dias</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600"></span> 3 dias</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-700"></span> 4 dias</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-stone-600"></span> 5 dias</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-stone-700"></span> 6 dias</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-stone-800"></span> 7+ dias</span>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-4">
              {portasOcupadas.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">Nenhuma porta ocupada no momento</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {portasOcupadas.map((porta) => (
                    <div
                      key={porta.porta_uid}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500 text-white rounded-lg flex items-center justify-center font-bold">
                          {porta.numero_porta}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{porta.gaveteiro_nome}</p>
                          <p className="text-xs text-gray-500">{porta.gaveteiro_codigo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold px-3 py-1 rounded-full ${getCorTempo(porta.tempo_ocupado_minutos)}`}>
                          {formatarTempo(porta.tempo_ocupado_minutos)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(porta.ocupado_em).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowRelatorio(false)}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header com Resumo - Design Harmonioso Sky */}
      <div className="bg-gradient-to-r from-sky-50 via-sky-100 to-blue-100 rounded-xl p-3 mt-4 mb-5 shadow-sm border border-sky-200">
        <div className="flex items-center justify-between gap-2">
          {/* Título */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-sky-700 rounded-lg flex items-center justify-center">
              <LayoutGrid size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-sky-800">Gaveteiros</h1>
          </div>
          
          {/* Cards de Estatísticas - Na mesma linha */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="bg-sky-100 rounded px-2 py-0.5 flex items-center gap-1 hover:bg-sky-200 transition-colors cursor-pointer group">
              <span className="text-sm font-bold text-sky-700 group-hover:scale-110 transition-transform">{totais.gaveteiros}</span>
              <span className="text-[8px] text-sky-500">total</span>
            </div>
            <div className="bg-green-100 rounded px-2 py-0.5 flex items-center gap-1 hover:bg-green-200 transition-colors cursor-pointer group">
              <span className="text-sm font-bold text-green-600 group-hover:scale-110 transition-transform">{totais.livres}</span>
              <span className="text-[8px] text-green-500">livres</span>
            </div>
            <div className="bg-red-100 rounded px-2 py-0.5 flex items-center gap-1 hover:bg-red-200 transition-colors cursor-pointer group">
              <span className="text-sm font-bold text-red-600 group-hover:scale-110 transition-transform">{totais.ocupadas}</span>
              <span className="text-[8px] text-red-500">ocupadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Gaveteiros */}
      <div>
          {loadingGaveteiros ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-lg shadow p-3 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(j => (
                      <div key={j} className="aspect-square bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : gaveteiros.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <LayoutGrid size={40} className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 text-sm">Nenhum gaveteiro encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {gaveteiros.map(gaveteiro => (
                <GaveteiroCompacto
                  key={gaveteiro.uid}
                  gaveteiro={gaveteiro}
                  condominioUid={condominio.uid}
                />
              ))}
            </div>
          )}
        </div>
    </div>
  )
}
