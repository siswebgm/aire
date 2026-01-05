import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Lock, Unlock, Key, Trash2, Users, AlertTriangle, X, RefreshCw, Maximize2, Minimize2, Activity, Search } from 'lucide-react'
import type { Porta } from '../../types/gaveteiro'
import { listarTodasPortas, ocuparPorta, liberarPortaComSenha, cancelarOcupacao, type Destinatario } from '../../services/gaveteiroService'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { PageHeader } from '../../../components/PageHeader'

// 🎨 Formata tempo em minutos para exibição legível - SEPARADO
function formatarTempo(minutos: number): string {
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  const mins = minutos % 60
  if (horas < 24) return `${horas}h ${mins}min`
  
  const dias = Math.floor(minutos / 1440)
  const horasRestantes = Math.floor((minutos % 1440) / 60)
  
  // 🎨 Formato separado para dias
  if (dias === 1 && horasRestantes === 0) return '1d'
  if (dias === 1) return `1d ${horasRestantes}h`
  if (horasRestantes === 0) return `${dias}d`
  return `${dias}d ${horasRestantes}h`
}

interface PortaDetalhada extends Porta {
  gaveteiro_nome?: string
  gaveteiro_codigo?: string
}

export default function TodasPortas() {
  const { condominio } = useAuth()
  const router = useRouter()
  const [portas, setPortas] = useState<PortaDetalhada[]>([])
  const [loading, setLoading] = useState(true)
  const [portaSelecionada, setPortaSelecionada] = useState<PortaDetalhada | null>(null)
  const [showPainelLateral, setShowPainelLateral] = useState(false)
  const [loadingAcao, setLoadingAcao] = useState(false)
  const [senhaLiberacao, setSenhaLiberacao] = useState('')
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([{ bloco: '', apartamento: '' }])
  const [showOcuparForm, setShowOcuparForm] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'disponiveis' | 'ocupadas'>('todas')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date())
  const [consultaBloco, setConsultaBloco] = useState('')
  const [consultaApartamento, setConsultaApartamento] = useState('')
  const [consultaAberta, setConsultaAberta] = useState(false)

  useEffect(() => {
    if (!consultaAberta) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConsultaAberta(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [consultaAberta])

  useEffect(() => {
    carregarPortas()
  }, [condominio?.uid])

  // Supabase Realtime updates
  useEffect(() => {
    if (!condominio?.uid) {
      console.log('Condomínio não disponível para realtime')
      return
    }

    console.log('Configurando Supabase Realtime para condomínio:', condominio.uid)

    // Inscrever para mudanças em tempo real na tabela de portas
    const channel = supabase
      .channel('portas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cobrancas', // Schema correto onde as tabelas existem
          table: 'gvt_portas',
          filter: `condominio_uid=eq.${condominio.uid}`
        },
        (payload) => {
          console.log('🔄 Mudança em tempo real detectada:', payload)
          console.log('📊 Evento:', payload.eventType)
          console.log('📋 Dados:', payload.new)
          carregarPortas() // Recarregar todas as portas quando houver mudança
          setUltimaAtualizacao(new Date())
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal Supabase:', status)
      })

    return () => {
      console.log('🔌 Removendo canal Supabase')
      supabase.removeChannel(channel)
    }
  }, [condominio?.uid])

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullScreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullScreen(false)
      }
    }
  }

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullScreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange)
    }
  }, [])

  const carregarPortas = async () => {
    if (!condominio?.uid) return
    
    console.log('🔄 Carregando portas para condomínio:', condominio.uid)
    setLoading(true)
    try {
      const todasPortas = await listarTodasPortas(condominio.uid)
      
      console.log('📋 Portas carregadas:', todasPortas.length)
      console.log('📊 Status:', {
        total: todasPortas.length,
        disponiveis: todasPortas.filter(p => p.status_atual === 'DISPONIVEL').length,
        ocupadas: todasPortas.filter(p => p.status_atual === 'OCUPADO').length
      })
      
      setPortas(todasPortas)
      setUltimaAtualizacao(new Date()) // Atualiza timestamp
    } catch (error) {
      console.error('❌ Erro ao carregar portas:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirDetalhesPorta = (porta: PortaDetalhada) => {
    router.push(`/porta/${porta.uid}`)
  }

  const executarAcaoPorta = async (acao: 'ocupar' | 'liberar' | 'cancelar') => {
    if (!portaSelecionada || !condominio?.uid) return

    setLoadingAcao(true)
    try {
      if (acao === 'ocupar') {
        const destinatariosValidos = destinatarios.filter(d => d.bloco && d.apartamento)
        if (destinatariosValidos.length === 0) {
          throw new Error('Informe pelo menos um destinatário')
        }

        await ocuparPorta({
          portaUid: portaSelecionada.uid,
          condominioUid: condominio.uid,
          destinatarios: destinatariosValidos
        })
        
        await carregarPortas()
        setShowPainelLateral(false)
        
      } else if (acao === 'liberar') {
        if (!senhaLiberacao) {
          throw new Error('Informe a senha de liberação')
        }

        const result = await liberarPortaComSenha(
          portaSelecionada.uid,
          condominio.uid,
          senhaLiberacao
        )
        
        if (result.sucesso) {
          await carregarPortas()
          setShowPainelLateral(false)
        } else {
          throw new Error(result.mensagem)
        }
        
      } else if (acao === 'cancelar') {
        const result = await cancelarOcupacao(
          portaSelecionada.uid,
          condominio.uid,
          'Cancelado pelo administrador'
        )
        
        if (result.sucesso) {
          await carregarPortas()
          setShowPainelLateral(false)
        } else {
          throw new Error(result.mensagem)
        }
      }
    } catch (error: any) {
      console.error('Erro ao executar ação na porta:', error)
      alert(error.message || 'Erro ao executar ação')
    } finally {
      setLoadingAcao(false)
    }
  }

  const adicionarDestinatario = () => {
    setDestinatarios([...destinatarios, { bloco: '', apartamento: '' }])
  }

  const removerDestinatario = (index: number) => {
    setDestinatarios(destinatarios.filter((_, i) => i !== index))
  }

  const atualizarDestinatario = (index: number, campo: 'bloco' | 'apartamento', valor: string) => {
    const novos = [...destinatarios]
    novos[index][campo] = valor
    setDestinatarios(novos)
  }

  const formatarData = (data: string | null) => {
    if (!data) return 'N/A'
    return new Date(data).toLocaleString('pt-BR')
  }

  const getCorPorta = (porta: PortaDetalhada) => {
    if (porta.status_atual === 'DISPONIVEL') return 'bg-green-500 hover:bg-green-600 text-white'
    if (porta.status_atual === 'OCUPADO') {
      // Apenas vermelho para ocupadas
      return 'bg-red-500 hover:bg-red-600 text-white'
    }
    return 'bg-gray-300 text-gray-500 cursor-not-allowed'
  }

  const getIndicadorLongaOcupacao = (porta: PortaDetalhada) => {
    // 🎨 NÃO PRECISA MAIS DO INDICADOR JÁ QUE O TEMPO APARECE NA PORTA
    return null
  }

  const getCorStatusFechadura = (status: string) => {
    switch (status) {
      case 'aberta': return 'bg-green-100 text-green-800 border-green-200'
      case 'fechada': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCorStatusSensor = (status: string) => {
    switch (status) {
      case 'aberta': return 'text-green-600'
      case 'fechada': return 'text-red-600'
      case 'desconhecido': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  const portasFiltradas = portas.filter(porta => {
    if (filtro === 'todas') return true
    if (filtro === 'disponiveis') return porta.status_atual === 'DISPONIVEL'
    if (filtro === 'ocupadas') return porta.status_atual === 'OCUPADO'
    return true
  })

  const portasOcupadas = portas.filter((p) => p.status_atual === 'OCUPADO')

  const paresDestinoDePorta = (porta: PortaDetalhada) => {
    const blocos = (porta.bloco_atual || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const apts = (porta.apartamento_atual || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (blocos.length === 0 && apts.length === 0) return [] as Array<{ bloco: string; apartamento: string }>
    if (blocos.length === apts.length && blocos.length > 0) {
      return blocos.map((b, idx) => ({ bloco: b, apartamento: apts[idx] || '' }))
    }
    return [{ bloco: porta.bloco_atual || '', apartamento: porta.apartamento_atual || '' }]
  }

  const blocosDisponiveisConsulta = Array.from(
    new Set(
      portasOcupadas
        .flatMap((p) => paresDestinoDePorta(p).map((d) => d.bloco))
        .map((b) => b.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const apartamentosDisponiveisConsulta = Array.from(
    new Set(
      portasOcupadas
        .flatMap((p) => paresDestinoDePorta(p))
        .filter((d) => (consultaBloco ? d.bloco === consultaBloco : true))
        .map((d) => d.apartamento)
        .map((a) => a.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const portasOcupadasDoDestino = portasOcupadas.filter((p) => {
    if (!consultaBloco || !consultaApartamento) return false
    const pares = paresDestinoDePorta(p)
    return pares.some((d) => d.bloco === consultaBloco && d.apartamento === consultaApartamento)
  })

  if (!condominio) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Todas as Portas"
        showBack={false}
        subtitle={
          <span className="text-slate-500">
            {portas.length} portas totais • {portas.filter((p) => p.status_atual === 'DISPONIVEL').length} disponíveis •{' '}
            {portas.filter((p) => p.status_atual === 'OCUPADO').length} ocupadas
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setFiltro('todas')}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                filtro === 'todas' ? 'bg-sky-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFiltro('disponiveis')}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                filtro === 'disponiveis'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Disponíveis
            </button>
            <button
              onClick={() => setFiltro('ocupadas')}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                filtro === 'ocupadas' ? 'bg-red-500 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Ocupadas
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setConsultaAberta((v) => !v)}
                className={`p-2.5 rounded-xl transition-all border ${
                  consultaAberta
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                }`}
                title="Consulta rápida"
                aria-label="Consulta rápida"
              >
                <Search size={18} />
              </button>

              {consultaAberta ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setConsultaAberta(false)} />
                  <div className="absolute right-0 mt-2 z-50 w-[320px] sm:w-[360px]">
                    <div className="absolute -top-2 right-5 h-4 w-4 rotate-45 bg-white/95 border border-slate-200/70 shadow" />
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/70 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-br from-white/80 to-slate-50/60">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                              <Search size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-slate-900 truncate">Consulta rápida</p>
                              <p className="text-xs text-slate-500 truncate">Bloco e apartamento</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setConsultaAberta(false)}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            aria-label="Fechar"
                            title="Fechar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="w-full">
                          <div className="flex w-full items-stretch gap-2">
                            <select
                              value={consultaBloco}
                              onChange={(e) => {
                                setConsultaBloco(e.target.value)
                                setConsultaApartamento('')
                              }}
                              className="h-11 flex-1 min-w-0 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200/70"
                            >
                              <option value="">Bloco</option>
                              {blocosDisponiveisConsulta.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>

                            <select
                              value={consultaApartamento}
                              onChange={(e) => setConsultaApartamento(e.target.value)}
                              disabled={!consultaBloco}
                              className="h-11 flex-1 min-w-0 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200/70 disabled:opacity-60"
                            >
                              <option value="">Apartamento</option>
                              {apartamentosDisponiveisConsulta.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                setConsultaBloco('')
                                setConsultaApartamento('')
                              }}
                              className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-gray-50"
                              title="Limpar"
                              aria-label="Limpar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>

                        {consultaBloco && consultaApartamento ? (
                          <div className="mt-4">
                            {portasOcupadasDoDestino.length > 0 ? (
                              <div className="flex flex-col gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                                <div className="text-sm font-semibold text-red-800">
                                  Encontrada(s) {portasOcupadasDoDestino.length} porta(s) ocupada(s)
                                </div>
                                <div className="grid gap-2">
                                  {portasOcupadasDoDestino
                                    .slice()
                                    .sort((a, b) => (a.numero_porta || 0) - (b.numero_porta || 0))
                                    .map((p) => (
                                      <button
                                        key={p.uid}
                                        type="button"
                                        onClick={() => {
                                          setConsultaAberta(false)
                                          abrirDetalhesPorta(p)
                                        }}
                                        className="w-full px-3 py-2 rounded-xl bg-white text-left border border-red-200 hover:bg-red-50"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-sm font-extrabold text-red-700">Porta {p.numero_porta}</span>
                                          <span className="text-[11px] font-semibold text-slate-600">
                                            {p.compartilhada ? 'Compartilhada' : 'Exclusiva'}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-600">
                                          Ocupado em: {formatarData(p.ocupado_em || null)}
                                        </div>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
                                Nenhuma porta ocupada
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <button
              onClick={toggleFullScreen}
              className="p-2.5 rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-all border border-gray-200"
              title={isFullScreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        }
      />

      {/* Grid de Portas */}
      {loading ? (
        <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-14 lg:grid-cols-16 xl:grid-cols-18 gap-0.5">
          {Array.from({ length: 216 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-sm animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-14 lg:grid-cols-16 xl:grid-cols-18 gap-0.5">
          {portasFiltradas.map((porta) => (
            <div
              key={porta.uid}
              className={`relative group aspect-square rounded-sm text-xs font-bold transition-all duration-200 cursor-pointer ${getCorPorta(porta)}`}
              onClick={() => abrirDetalhesPorta(porta)}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {porta.status_atual === 'OCUPADO' && porta.ocupado_em && (
                  (() => {
                    const minutosOcupada = (new Date().getTime() - new Date(porta.ocupado_em).getTime()) / (1000 * 60)
                    const dias = Math.floor(minutosOcupada / 1440)
                    
                    if (dias >= 1) {
                      // 🎨 NÚMERO GRANDE, TEMPO PEQUENO (SEM REPETIÇÃO)
                      return (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-sm font-bold">{porta.numero_porta}</span>
                          <span className="text-[6px] text-white font-medium leading-tight opacity-80">
                            {formatarTempo(minutosOcupada)}
                          </span>
                        </div>
                      )
                    }
                    return <span className="text-sm font-bold">{porta.numero_porta}</span>
                  })()
                ) || <span className="text-sm font-bold">{porta.numero_porta}</span>}
              </div>
              
              {/* 🎨 SEM INDICADORES VISUAIS - APENAS CORES E TEMPO */}
              
              {/* Status da fechadura */}
              {porta.fechadura_status && porta.fechadura_status === 'aberta' && (
                <div className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 px-0.5 py-0.5 rounded text-[6px] font-medium ${getCorStatusFechadura(porta.fechadura_status)}`}>
                  Aberta
                </div>
              )}
              
              {/* Status do sensor */}
              {porta.sensor_ima_status && porta.sensor_ima_status === 'aberto' && (
                <div className="absolute top-0.5 left-1/2 transform -translate-x-1/2 px-0.5 py-0.5 rounded text-[6px] font-medium bg-white/90 backdrop-blur-sm">
                  <span className={getCorStatusSensor(porta.sensor_ima_status)}>
                    🔓
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
