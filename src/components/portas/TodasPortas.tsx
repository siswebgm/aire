import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { DoorOpen, Lock, Unlock, Key, Trash2, Users, AlertTriangle, X, RefreshCw, Maximize2, Minimize2, Activity } from 'lucide-react'
import type { Porta } from '../../types/gaveteiro'
import { listarTodasPortas, ocuparPorta, liberarPortaComSenha, cancelarOcupacao, type Destinatario } from '../../services/gaveteiroService'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'

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
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-md border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              <DoorOpen size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 bg-clip-text text-transparent">Todas as Portas</h1>
              <p className="text-sm text-sky-600">
                {portas.length} portas totais • {portas.filter(p => p.status_atual === 'DISPONIVEL').length} disponíveis • {portas.filter(p => p.status_atual === 'OCUPADO').length} ocupadas
              </p>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setFiltro('todas')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filtro === 'todas'
                  ? 'bg-sky-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFiltro('disponiveis')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filtro === 'disponiveis'
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Disponíveis
            </button>
            <button
              onClick={() => setFiltro('ocupadas')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filtro === 'ocupadas'
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Ocupadas
            </button>
            <button
              onClick={toggleFullScreen}
              className="p-2 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-all"
              title={isFullScreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Portas */}
      {loading ? (
        <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-14 lg:grid-cols-16 xl:grid-cols-18 gap-0.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
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
