import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import {
  Lock,
  Unlock,
  Key,
  Trash2,
  Users,
  AlertTriangle,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  Activity,
  Search,
  Check,
  Calendar,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  Package,
  Building2,
  Wifi,
  User,
  LayoutGrid,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import type { Porta } from '../../types/gaveteiro'
import { listarTodasPortas, ocuparPorta, liberarPortaComSenha, cancelarOcupacao, listarUltimasEntregas, type Destinatario } from '../../services/gaveteiroService'
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

function normalizarAcao(v: unknown): string {
  return String(v || '').trim().toUpperCase()
}

function badgeAcaoClasses(acaoRaw: unknown, cancelado?: boolean): string {
  if (cancelado) return 'border-red-200 bg-red-50 text-red-800'

  const acao = normalizarAcao(acaoRaw)
  if (!acao) return 'border-slate-200 bg-slate-50 text-slate-700'

  switch (acao) {
    case 'OCUPADO':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'DISPONIVEL':
      return 'border-slate-200 bg-slate-50 text-slate-700'
    case 'BAIXADO':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'RETIRAR':
    case 'RETIRADA':
      return 'border-sky-200 bg-sky-50 text-sky-900'
    case 'LIBERAR':
      return 'border-indigo-200 bg-indigo-50 text-indigo-900'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
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
  const [portalMounted, setPortalMounted] = useState(false)
  const [grupoFocusAberto, setGrupoFocusAberto] = useState(false)
  const [ultimasEntregas, setUltimasEntregas] = useState<any[]>([])
  const [filtroEntregas, setFiltroEntregas] = useState<'todas' | 'ocupado' | 'retirada' | 'cancelado'>('todas')
  const [loadingEntregas, setLoadingEntregas] = useState(false)
  const [erroEntregas, setErroEntregas] = useState<string | null>(null)
  const [graficosAbertos, setGraficosAbertos] = useState(false)
  const [portaSelecionada, setPortaSelecionada] = useState<PortaDetalhada | null>(null)
  const [showPainelLateral, setShowPainelLateral] = useState(false)
  const [loadingAcao, setLoadingAcao] = useState(false)
  const [senhaLiberacao, setSenhaLiberacao] = useState('')
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([{ bloco: '', apartamento: '' }])
  const [showOcuparForm, setShowOcuparForm] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'disponiveis' | 'ocupadas'>('todas')
  const [filtroTamanho, setFiltroTamanho] = useState<string>('todos')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date())
  const [consultaBloco, setConsultaBloco] = useState('')
  const [consultaApartamento, setConsultaApartamento] = useState('')
  const [consultaAberta, setConsultaAberta] = useState(false)
  const [editarPeriodoEntregas, setEditarPeriodoEntregas] = useState(false)
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [entregasDoDia, setEntregasDoDia] = useState<any[]>([])

  const today = new Date()
  const defaultFim = new Date(today)
  const defaultInicio = new Date(today.getFullYear(), today.getMonth(), 1) // Primeiro dia do mês atual

  const [dataInicio, setDataInicio] = useState(() => defaultInicio.toISOString().slice(0, 10))
  const [dataFim, setDataFim] = useState(() => defaultFim.toISOString().slice(0, 10))

  const formatarDataCurta = (isoDate: string) => {
    const d = isoDate ? new Date(`${isoDate}T00:00:00.000`) : null
    if (!d || Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR')
  }

  useEffect(() => {
    if (!consultaAberta) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConsultaAberta(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [consultaAberta])

  useEffect(() => {
    setPortalMounted(true)
  }, [])

  useEffect(() => {
    if (!grupoFocusAberto) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGrupoFocusAberto(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [grupoFocusAberto])

  useEffect(() => {
    carregarPortas()
  }, [condominio?.uid])

  const carregarUltimasEntregas = async (limite?: number, range?: { from?: string; to?: string }) => {
    if (!condominio?.uid) return
    setLoadingEntregas(true)
    setErroEntregas(null)
    try {
      const data = await listarUltimasEntregas(condominio.uid, limite ?? 20, range)
      setUltimasEntregas(data as any[])
    } catch (error) {
      console.error('❌ Erro ao carregar últimas entregas:', error)
      const msg =
        error && typeof error === 'object' && 'message' in (error as any)
          ? String((error as any).message)
          : 'Erro ao carregar últimas entregas'
      setErroEntregas(msg)
    } finally {
      setLoadingEntregas(false)
    }
  }

  useEffect(() => {
    if (!graficosAbertos) return
    if (!condominio?.uid) return
    if (loadingEntregas) return

    const from = dataInicio ? new Date(`${dataInicio}T00:00:00.000`).toISOString() : undefined
    const to = dataFim ? new Date(`${dataFim}T23:59:59.999`).toISOString() : undefined
    const days = dataInicio && dataFim ? Math.max(1, Math.round((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 7
    const limite = Math.min(2000, Math.max(50, days * 40))
    carregarUltimasEntregas(limite, { from, to })
  }, [graficosAbertos, condominio?.uid, dataInicio, dataFim])

  const carregarPortasSilencioso = async () => {
    if (!condominio?.uid) return
    try {
      const todasPortas = await listarTodasPortas(condominio.uid)
      setPortas(todasPortas)
      setUltimaAtualizacao(new Date())
    } catch (error) {
      console.error('❌ Erro ao carregar portas (silencioso):', error)
    }
  }

  useEffect(() => {
    if (!grupoFocusAberto) return
    carregarUltimasEntregas()
  }, [grupoFocusAberto, condominio?.uid])

  const destinosMovimentacaoComFallback = (m: any) => {
    const destinos = destinosMovimentacao(m)
    if (destinos.length > 0) return destinos

    const acao = normalizarAcao(m?.acao)
    if (acao !== 'RETIRADA' && acao !== 'RETIRAR') return destinos

    const portaUid = m?.porta_uid
    if (!portaUid) return destinos

    const tsAtual = m?.timestamp ? new Date(m.timestamp).getTime() : null

    const anterior = (ultimasEntregas || [])
      .filter((x) => x && x.porta_uid === portaUid)
      .filter((x) => !x?.cancelado)
      .filter((x) => normalizarAcao(x?.acao) === 'OCUPADO')
      .filter((x) => {
        if (!tsAtual) return true
        const tsX = x?.timestamp ? new Date(x.timestamp).getTime() : null
        return tsX ? tsX <= tsAtual : true
      })
      .sort((a, b) => {
        const ta = a?.timestamp ? new Date(a.timestamp).getTime() : 0
        const tb = b?.timestamp ? new Date(b.timestamp).getTime() : 0
        return tb - ta
      })[0]

    if (!anterior) return destinos
    return destinosMovimentacao(anterior)
  }

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

          // Evitar piscar o grid (setLoading) a cada evento.
          // Atualiza de forma incremental usando payload.new/old.
          if (payload.eventType === 'UPDATE' && payload.new && typeof payload.new === 'object') {
            const novo: any = payload.new
            let encontrou = false
            setPortas((prev) => {
              const next = prev.map((p) => {
                if (p.uid === novo.uid) {
                  encontrou = true
                  return { ...p, ...novo }
                }
                return p
              })
              return next
            })

            // Se não encontrou a porta no estado atual, faz refresh silencioso.
            if (!encontrou) {
              carregarPortasSilencioso()
            }
          } else if (payload.eventType === 'INSERT' && payload.new && typeof payload.new === 'object') {
            const novo: any = payload.new
            setPortas((prev) => {
              if (prev.some((p) => p.uid === novo.uid)) return prev
              // payload.new pode não conter campos derivados (ex.: gaveteiro_nome), então inserimos e depois sincronizamos.
              return [{ ...(novo as any) }, ...prev]
            })
            carregarPortasSilencioso()
          } else if (payload.eventType === 'DELETE' && payload.old && typeof payload.old === 'object') {
            const antigo: any = payload.old
            setPortas((prev) => prev.filter((p) => p.uid !== antigo.uid))
          } else {
            // Fallback para tipos inesperados
            carregarPortasSilencioso()
          }

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
    if (!condominio?.uid) {
      console.log('⚠️ Condomínio não disponível, aguardando...')
      return
    }
    
    const condominioUid = condominio.uid
    const condominioNome = condominio.nome
    
    console.log('🔄 Carregando portas para condomínio:', condominioUid)
    console.log('🏢 Nome do condomínio:', condominioNome)
    setLoading(true)
    try {
      const todasPortas = await listarTodasPortas(condominioUid)
      
      console.log('📋 Portas carregadas:', todasPortas.length)
      console.log('📊 Status:', {
        total: todasPortas.length,
        disponiveis: todasPortas.filter(p => p.status_atual === 'DISPONIVEL').length,
        ocupadas: todasPortas.filter(p => p.status_atual === 'OCUPADO').length
      })
      
      // 🔍 VERIFICAÇÃO DE SEGURANÇA: Mostrar UIDs das portas para debug
      if (todasPortas.length > 0) {
        console.log('🔍 Primeira porta (debug):', {
          uid: todasPortas[0].uid,
          numero: todasPortas[0].numero_porta,
          condominio_uid: todasPortas[0].condominio_uid,
          matches: todasPortas[0].condominio_uid === condominioUid
        })
      }
      
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
        if ((portaSelecionada as any)?.reservada_portaria) {
          throw new Error('Esta porta está reservada para a portaria e não pode ser utilizada para entregas.')
        }

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

  const destinosMovimentacao = (m: any): Array<{ bloco: string; apartamento: string }> => {
    const toPairsFromJson = (value: any) => {
      if (!value) return [] as Array<{ bloco: string; apartamento: string }>
      if (Array.isArray(value)) {
        return value
          .map((d) => ({ bloco: String(d?.bloco ?? '').trim(), apartamento: String(d?.apartamento ?? '').trim() }))
          .filter((d) => d.bloco || d.apartamento)
      }
      return []
    }

    const fromResumo = toPairsFromJson(m.destinatarios_resumo)
    if (fromResumo.length > 0) return fromResumo

    const fromDest = toPairsFromJson(m.destinatarios)
    if (fromDest.length > 0) return fromDest

    const blocos = String(m.bloco ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const apts = String(m.apartamento ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (blocos.length === 0 && apts.length === 0) return []
    if (blocos.length === apts.length && blocos.length > 0) {
      return blocos.map((b, idx) => ({ bloco: b, apartamento: apts[idx] || '' }))
    }
    if (blocos.length > 0 && apts.length === 0) return blocos.map((b) => ({ bloco: b, apartamento: '' }))
    if (apts.length > 0 && blocos.length === 0) return apts.map((a) => ({ bloco: '', apartamento: a }))
    return [{ bloco: blocos.join(', '), apartamento: apts.join(', ') }]
  }

  const getCorPorta = (porta: PortaDetalhada) => {
    if ((porta as any)?.reservada_portaria) return 'bg-slate-500 hover:bg-slate-600 text-white'
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
    // Filtro por status
    if (filtro === 'disponiveis' && porta.status_atual !== 'DISPONIVEL') return false
    if (filtro === 'ocupadas' && porta.status_atual !== 'OCUPADO') return false
    
    // Filtro por tamanho
    if (filtroTamanho !== 'todos' && porta.tamanho !== filtroTamanho) return false
    
    // Excluir portas reservadas da portaria no filtro de disponíveis
    if (filtro === 'disponiveis' && (porta as any).reservada_portaria) return false
    
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

  const totalPortas = portas.length
  const qtdDisponiveis = portas.filter((p) => p.status_atual === 'DISPONIVEL').length
  const qtdOcupadas = portas.filter((p) => p.status_atual === 'OCUPADO').length

  const statusBars = [
    { key: 'DISPONIVEL', label: 'Disponíveis', value: qtdDisponiveis, color: 'bg-emerald-500' },
    { key: 'OCUPADO', label: 'Ocupadas', value: qtdOcupadas, color: 'bg-red-500' }
  ]

  const diasEntrega = (() => {
    const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00.000`) : null
    const fim = dataFim ? new Date(`${dataFim}T00:00:00.000`) : null
    if (!inicio || !fim || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return [] as Date[]

    const days = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      d.setHours(0, 0, 0, 0)
      return d
    })
  })()

  const entregasPorDia = diasEntrega.map((d) => {
    const key = d.toISOString().slice(0, 10)
    const count = ultimasEntregas.filter((m) => {
      const ts = m?.timestamp ? new Date(m.timestamp) : null
      if (!ts || Number.isNaN(ts.getTime())) return false
      const tsKey = ts.toISOString().slice(0, 10)
      return tsKey === key
    }).length

    return {
      key,
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value: count
    }
  })

  const maxEntregasDia = Math.max(1, ...entregasPorDia.map((x) => x.value))

  const mediaMinutosPorStatus = (status: 'OCUPADO' | 'DISPONIVEL') => {
    const nowMs = Date.now()
    const amostra = portas.filter((p) => p.status_atual === status)
    if (amostra.length === 0) return 0

    const totalMin = amostra.reduce((acc, p) => {
      const tsRaw =
        status === 'OCUPADO'
          ? p.ocupado_em || p.ultimo_evento_em
          : (p.finalizado_em || p.ultimo_evento_em)

      const ts = tsRaw ? new Date(tsRaw) : null
      const ms = ts && !Number.isNaN(ts.getTime()) ? nowMs - ts.getTime() : 0
      return acc + Math.max(0, ms / (1000 * 60))
    }, 0)

    return totalMin / amostra.length
  }

  const mediaMinOcupadas = mediaMinutosPorStatus('OCUPADO')
  const mediaMinDisponiveis = mediaMinutosPorStatus('DISPONIVEL')
  const maxMediaMin = Math.max(1, mediaMinOcupadas, mediaMinDisponiveis)

  const totalStatusParaDonut = statusBars.reduce((acc, s) => acc + s.value, 0)
  const donutSize = 120
  const donutStroke = 14
  const donutR = (donutSize - donutStroke) / 2
  const donutC = 2 * Math.PI * donutR

  const donutSlices = statusBars
    .filter((s) => s.value > 0)
    .map((s) => ({
      ...s,
      pct: totalStatusParaDonut > 0 ? s.value / totalStatusParaDonut : 0
    }))

  if (!condominio) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Carregando...</p>
      </div>
    )
  }

  return (
    <div className={`${diaSelecionado ? 'overflow-hidden' : ''}`}>
      {/* Header */}
      <PageHeader
        title="Todas as Portas"
        showBack={false}
        borderTone="medium"
        subtitle={
          <span className="text-slate-500">
            {portas.length} portas totais • {portas.filter((p) => p.status_atual === 'DISPONIVEL').length} disponíveis •{' '}
            {portas.filter((p) => p.status_atual === 'OCUPADO').length} ocupadas
          </span>
        }
        actions={
          <div className="w-full flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-center">
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

            <select
              value={filtroTamanho}
              onChange={(e) => setFiltroTamanho(e.target.value)}
              className="px-4 py-2 rounded-xl font-semibold bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 transition-all"
            >
              <option value="todos">Todos tamanhos</option>
              <option value="P">Tamanho P</option>
              <option value="M">Tamanho M</option>
              <option value="G">Tamanho G</option>
              <option value="GG">Tamanho GG</option>
            </select>

            <button
              onClick={toggleFullScreen}
              className="p-2.5 rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-all border border-gray-200"
              title={isFullScreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
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
                  <div className="absolute right-0 mt-2 z-50 w-[92vw] max-w-[360px]">
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
              type="button"
              onClick={() => setGrupoFocusAberto(true)}
              className="p-2.5 rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-all border border-gray-200"
              title="Últimas entregas"
              aria-label="Últimas entregas"
            >
              <Activity size={18} />
            </button>
          </div>
        }
      />

      {portalMounted && grupoFocusAberto
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" onClick={() => setGrupoFocusAberto(false)} />
              <div className="fixed inset-y-0 right-0 z-[9999] h-[100dvh] w-[440px] max-w-[92vw] bg-white/95 shadow-2xl border-l border-slate-200/70 flex flex-col overflow-hidden rounded-l-3xl">
                <div className="sticky top-0 border-b border-slate-200/70 bg-gradient-to-b from-white/80 to-white/60 backdrop-blur-xl">
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                      <Activity size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 truncate">Últimas entregas</p>
                      <p className="text-xs text-slate-500 truncate">Movimentações recentes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => carregarUltimasEntregas()}
                      className="p-2.5 rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-white/80 ring-1 ring-slate-200/70 shadow-sm transition-colors"
                      aria-label="Atualizar"
                      title="Atualizar"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrupoFocusAberto(false)}
                      className="p-2.5 rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-white/80 ring-1 ring-slate-200/70 shadow-sm transition-colors"
                      aria-label="Fechar"
                      title="Fechar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-b border-slate-200/70 bg-white/60 backdrop-blur-xl">
                  <div className="flex w-full rounded-2xl bg-white/90 ring-1 ring-slate-200/70 shadow-sm p-1">
                    <button
                      type="button"
                      onClick={() => setFiltroEntregas('todas')}
                      className={
                        'flex-1 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors text-center ' +
                        (filtroEntregas === 'todas'
                          ? 'bg-slate-900 text-white shadow'
                          : 'text-slate-700 hover:bg-slate-100/80')
                      }
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroEntregas('ocupado')}
                      className={
                        'flex-1 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors text-center ' +
                        (filtroEntregas === 'ocupado'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-700 hover:bg-slate-100/80')
                      }
                    >
                      Ocupado
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroEntregas('retirada')}
                      className={
                        'flex-1 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors text-center ' +
                        (filtroEntregas === 'retirada'
                          ? 'bg-sky-600 text-white shadow'
                          : 'text-slate-700 hover:bg-slate-100/80')
                      }
                    >
                      Retirada
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroEntregas('cancelado')}
                      className={
                        'flex-1 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors text-center ' +
                        (filtroEntregas === 'cancelado'
                          ? 'bg-red-600 text-white shadow'
                          : 'text-slate-700 hover:bg-slate-100/80')
                      }
                    >
                      Cancelado
                    </button>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1 bg-gradient-to-b from-white/40 via-slate-50/40 to-slate-100/40">
                  {erroEntregas ? (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                      {erroEntregas}
                    </div>
                  ) : null}
                  {loadingEntregas ? (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin w-7 h-7 border-4 border-sky-600 border-t-transparent rounded-full" />
                    </div>
                  ) : ultimasEntregas.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      <p className="text-sm font-semibold">Nenhuma entrega recente</p>
                      <p className="text-xs">Quando houver novas movimentações, elas aparecem aqui.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ultimasEntregas
                        .filter((m) => {
                          if (filtroEntregas === 'todas') return true
                          if (filtroEntregas === 'cancelado') return Boolean(m?.cancelado)
                          if (filtroEntregas === 'retirada') return !m?.cancelado && ['RETIRADA', 'RETIRAR'].includes(normalizarAcao(m?.acao))
                          return !m?.cancelado && normalizarAcao(m?.acao) === 'OCUPADO'
                        })
                        .map((m) => (
                          <button
                            key={m.uid}
                            type="button"
                            onClick={() => {
                              if (m.porta_uid) router.push(`/porta/${m.porta_uid}`)
                            }}
                            className={
                              "group relative w-full text-left rounded-2xl border px-4 py-3 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 overflow-hidden " +
                              (m.cancelado
                                ? 'border-red-200/80 bg-red-50/80 hover:bg-red-100/70 hover:shadow-md'
                                : normalizarAcao(m.acao) === 'OCUPADO'
                                  ? 'border-emerald-200/80 bg-emerald-50/80 hover:bg-emerald-100/60 hover:shadow-md'
                                  : ['RETIRADA', 'RETIRAR'].includes(normalizarAcao(m.acao))
                                    ? 'border-sky-200/80 bg-sky-50/80 hover:bg-sky-100/60 hover:shadow-md'
                                  : 'border-slate-200/80 bg-white/90 hover:bg-white hover:shadow-md')
                            }
                          >
                            <span
                              className={
                                'absolute left-0 top-0 h-full w-1.5 ' +
                                (m.cancelado
                                  ? 'bg-gradient-to-b from-red-500/70 to-red-400/30'
                                  : normalizarAcao(m.acao) === 'OCUPADO'
                                    ? 'bg-gradient-to-b from-emerald-500/70 to-emerald-400/30'
                                    : ['RETIRADA', 'RETIRAR'].includes(normalizarAcao(m.acao))
                                      ? 'bg-gradient-to-b from-sky-600/70 to-sky-400/30'
                                    : 'bg-gradient-to-b from-slate-300/70 to-slate-200/20')
                              }
                            />
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-extrabold text-slate-900 truncate group-hover:text-slate-950">
                                  Porta {m.numero_porta ?? '—'}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold ' +
                                      badgeAcaoClasses(m.acao, Boolean(m.cancelado))
                                    }
                                  >
                                    {m.cancelado ? (
                                      <X size={10} className="mr-1" />
                                    ) : normalizarAcao(m.acao) === 'OCUPADO' ? (
                                      <Check size={10} className="mr-1" />
                                    ) : ['RETIRADA', 'RETIRAR'].includes(normalizarAcao(m.acao)) ? (
                                      <Package size={10} className="mr-1" />
                                    ) : null}
                                    {m.cancelado ? 'CANCELADO' : normalizarAcao(m.acao) || '—'}
                                  </span>

                                  {typeof m.comunicado_morador === 'boolean' ? (
                                    <span
                                      className={
                                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold ' +
                                        (m.comunicado_morador
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                          : 'border-slate-200 bg-slate-50 text-slate-700')
                                      }
                                    >
                                      {m.comunicado_morador ? (
                                        <Check size={10} className="mr-1" />
                                      ) : (
                                        <X size={10} className="mr-1" />
                                      )}
                                      Comunicado: {m.comunicado_morador ? 'Sim' : 'Não'}
                                    </span>
                                  ) : null}
                                </div>
                                {(() => {
                                  const destinos = destinosMovimentacaoComFallback(m)
                                  if (destinos.length === 0) {
                                    return <p className="text-xs text-slate-600 truncate">Destino: —</p>
                                  }

                                  return (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {destinos.map((d, idx) => (
                                        <span
                                          key={`${d.bloco}-${d.apartamento}-${idx}`}
                                          className="inline-flex items-center rounded-full border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-xs"
                                        >
                                          {d.bloco ? `Bloco ${d.bloco}` : 'Bloco —'}
                                          {' • '}
                                          {d.apartamento ? `Apt ${d.apartamento}` : 'Apt —'}
                                        </span>
                                      ))}
                                    </div>
                                  )
                                })()}
                              </div>
                              <div className="text-[11px] text-slate-500 whitespace-nowrap flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/70 px-2 py-1">
                                <Activity size={10} className="opacity-70" />
                                {formatarData(m.timestamp || null)}
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </>,
            document.body
          )
        : null}

      <div className="mt-6 space-y-5">
      {/* Grid de Portas */}
      {loading ? (
        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-18 gap-0.5">
          {Array.from({ length: 216 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-sm animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-18 gap-0.5">
          {portasFiltradas.map((porta) => (
            <div
              key={porta.uid}
              className={`relative group aspect-square rounded-sm text-xs font-bold transition-all duration-200 cursor-pointer ${getCorPorta(porta)}`}
              onClick={() => abrirDetalhesPorta(porta)}
            >
              {/* Indicador de tamanho no canto superior direito */}
              {porta.tamanho && (
                <div className="absolute top-0.5 right-0.5 z-10">
                  <div className={`${getCorPorta(porta)} text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg opacity-90`}>
                    {porta.tamanho}
                  </div>
                </div>
              )}
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {porta.status_atual === 'OCUPADO' && porta.ocupado_em && (
                  (() => {
                    const minutosOcupada = (new Date().getTime() - new Date(porta.ocupado_em).getTime()) / (1000 * 60)
                    const dias = Math.floor(minutosOcupada / 1440)
                    
                    if (dias >= 1) {
                      // 🎨 NÚMERO GRANDE, TEMPO PEQUENO (SEM REPETIÇÃO)
                      return (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-lg font-bold text-white drop-shadow-lg">{porta.numero_porta}</span>
                          <span className="text-[6px] text-white font-medium leading-tight opacity-80">
                            {formatarTempo(minutosOcupada)}
                          </span>
                        </div>
                      )
                    }
                    return <span className="text-lg font-bold text-white drop-shadow-lg">{porta.numero_porta}</span>
                  })()
                ) || (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-white drop-shadow-lg">{porta.numero_porta}</span>
                  </div>
                )}
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
                <div className="absolute top-0.5 left-1/2 transform -translate-x-1/2 px-0.5 py-0.5 rounded text-[6px] font-medium">
                  <AlertTriangle
                    size={14}
                    className="text-amber-300 drop-shadow-sm"
                    strokeWidth={2.5}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setGraficosAbertos((v) => !v)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm px-4 py-3 text-left shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <BarChart3 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900 truncate">Gráficos</p>
              <p className="text-xs text-slate-500 truncate">Resumo de status e movimentações</p>
            </div>
          </div>
          <div className="text-slate-500">
            {graficosAbertos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {graficosAbertos ? (
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-br from-white/70 to-slate-50/60">
                <p className="text-sm font-extrabold text-slate-900">Portas por status</p>
                <p className="text-xs text-slate-500">Distribuição geral</p>
              </div>
              <div className="p-4 grid gap-4 sm:grid-cols-[160px_1fr] items-center">
                <div className="flex items-center justify-center">
                  <div className="relative" style={{ width: donutSize, height: donutSize }}>
                    <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`} className="block">
                      <circle
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={donutR}
                        fill="transparent"
                        stroke="rgb(241 245 249)"
                        strokeWidth={donutStroke}
                      />
                      {(() => {
                        let offset = 0
                        return donutSlices.map((s) => {
                          const len = donutC * s.pct
                          const dashArray = `${len} ${donutC - len}`
                          const dashOffset = -offset
                          offset += len
                          const stroke =
                            s.key === 'DISPONIVEL'
                              ? 'rgb(16 185 129)'
                              : s.key === 'OCUPADO'
                                ? 'rgb(239 68 68)'
                                : s.key === 'AGUARDANDO_RETIRADA'
                                  ? 'rgb(245 158 11)'
                                  : 'rgb(100 116 139)'

                          return (
                            <circle
                              key={s.key}
                              cx={donutSize / 2}
                              cy={donutSize / 2}
                              r={donutR}
                              fill="transparent"
                              stroke={stroke}
                              strokeWidth={donutStroke}
                              strokeDasharray={dashArray}
                              strokeDashoffset={dashOffset}
                              strokeLinecap="round"
                              transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                            />
                          )
                        })
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-lg font-extrabold text-slate-900">{totalPortas}</div>
                      <div className="text-[11px] font-semibold text-slate-500">portas</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  {statusBars.map((s) => {
                    const pct = totalPortas > 0 ? Math.round((s.value / totalPortas) * 100) : 0
                    const dot =
                      s.key === 'DISPONIVEL'
                        ? 'bg-emerald-500'
                        : s.key === 'OCUPADO'
                          ? 'bg-red-500'
                          : s.key === 'AGUARDANDO_RETIRADA'
                            ? 'bg-amber-500'
                            : 'bg-slate-500'

                    return (
                      <div key={s.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                          <span className="text-xs font-bold text-slate-700 truncate">{s.label}</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 whitespace-nowrap">
                          {s.value} <span className="text-slate-500 font-semibold">({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-br from-white/70 to-slate-50/60">
                <p className="text-sm font-extrabold text-slate-900">Status de porta</p>
                <p className="text-xs text-slate-500">Distribuição em colunas</p>
              </div>
              <div className="p-4">
                {(() => {
                  const disponivel = statusBars.find((s) => s.key === 'DISPONIVEL')?.value ?? 0
                  const ocupada = statusBars.find((s) => s.key === 'OCUPADO')?.value ?? 0
                  const maxV = Math.max(1, disponivel, ocupada)

                  const cols = [
                    { key: 'DISPONIVEL', label: 'Disponíveis', value: disponivel, colors: { front: '#22c55e', side: '#16a34a', top: '#4ade80' } },
                    { key: 'OCUPADO', label: 'Ocupadas', value: ocupada, colors: { front: '#ef4444', side: '#b91c1c', top: '#f87171' } }
                  ]

                  return (
                    <div className="grid grid-cols-2 gap-4">
                      {cols.map((c) => {
                        const pct = c.value / maxV
                        const hPx = Math.round((pct > 0 ? Math.max(0.12, pct) : 0) * 120)
                        const showH = c.value > 0 ? Math.max(10, hPx) : 0

                        return (
                          <div key={c.key} className="rounded-2xl border border-slate-200/70 bg-white/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-extrabold text-slate-700">{c.label}</p>
                              <p className="text-xs font-extrabold text-slate-900">{c.value}</p>
                            </div>

                            <div className="mt-3 h-36 flex items-end justify-center">
                              <div className="relative w-[56px]">
                                <div className="absolute -bottom-1 left-0 right-0 h-2 rounded-full bg-slate-200/70" />
                                <div className="relative" style={{ height: 144 }}>
                                  {c.value > 0 ? (
                                    <>
                                      <div
                                        className="absolute left-1/2 -translate-x-1/2 text-[12px] font-extrabold text-slate-900"
                                        style={{ top: 144 - showH - 22 }}
                                      >
                                        {c.value}
                                      </div>

                                      <div
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-sm"
                                        style={{ width: 40, height: showH, background: c.colors.front }}
                                      />
                                      <div
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom"
                                        style={{
                                          width: 12,
                                          height: showH,
                                          background: c.colors.side,
                                          transform: 'translateX(20px) skewY(-22deg)',
                                          borderRadius: 2
                                        }}
                                      />
                                      <div
                                        className="absolute left-1/2 -translate-x-1/2"
                                        style={{
                                          width: 40,
                                          height: 10,
                                          background: c.colors.top,
                                          transform: `translateY(${144 - showH - 5}px) skewX(-35deg) translateX(6px)`,
                                          borderRadius: 2
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-400">0</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-br from-white/70 to-slate-50/60">
                <p className="text-sm font-extrabold text-slate-900">Média de tempo por porta</p>
                <p className="text-xs text-slate-500">Tempo desde a última mudança de status</p>
              </div>
              <div className="p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-extrabold text-emerald-900">Disponível</p>
                      <p className="text-xs font-extrabold text-emerald-900">{formatarTempo(mediaMinDisponiveis)}</p>
                    </div>
                    <div className="mt-2 h-2.5 w-full rounded-full bg-white/70 ring-1 ring-emerald-200/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                        style={{ width: `${Math.min(100, (mediaMinDisponiveis / maxMediaMin) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-emerald-800/90">Média de tempo sem ocupação</p>
                  </div>

                  <div className="rounded-2xl border border-red-200/60 bg-red-50/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-extrabold text-red-900">Ocupada</p>
                      <p className="text-xs font-extrabold text-red-900">{formatarTempo(mediaMinOcupadas)}</p>
                    </div>
                    <div className="mt-2 h-2.5 w-full rounded-full bg-white/70 ring-1 ring-red-200/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600"
                        style={{ width: `${Math.min(100, (mediaMinOcupadas / maxMediaMin) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-red-800/90">Média de tempo em ocupação</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/70 bg-gradient-to-br from-white/70 to-slate-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">Entregas por dia</p>
                    <p className="text-xs text-slate-500 truncate">
                      {formatarDataCurta(dataInicio)} — {formatarDataCurta(dataFim)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditarPeriodoEntregas((v) => !v)}
                    className={
                      'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-extrabold shadow-sm transition-colors ' +
                      (editarPeriodoEntregas
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200/70 bg-white/80 text-slate-700 hover:bg-white')
                    }
                    aria-label="Selecionar período"
                    title="Selecionar período"
                  >
                    <Calendar size={14} />
                    Período
                    {editarPeriodoEntregas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>
              <div className="p-4">
                {editarPeriodoEntregas ? (
                  <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-extrabold text-slate-700">Data inicial</span>
                        <input
                          type="date"
                          value={dataInicio}
                          onChange={(e) => {
                            const v = e.target.value
                            setDataInicio(v)
                            if (dataFim && v && v > dataFim) setDataFim(v)
                          }}
                          className="h-10 rounded-xl border border-slate-200/70 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-extrabold text-slate-700">Data final</span>
                        <input
                          type="date"
                          value={dataFim}
                          min={dataInicio}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="h-10 rounded-xl border border-slate-200/70 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Dica: escolha um intervalo menor para ver o gráfico com mais detalhes.
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditarPeriodoEntregas(false)}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-extrabold text-white"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                ) : null}

                {loadingEntregas && ultimasEntregas.length === 0 ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin w-6 h-6 border-4 border-sky-600 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex gap-2 items-end min-w-max">
                      {entregasPorDia.map((d) => {
                        const pct = d.value / maxEntregasDia
                        const hPx = Math.round((pct > 0 ? Math.max(0.06, pct) : 0) * 96)

                        const palette = [
                          { front: '#0ea5e9', side: '#0284c7', top: '#38bdf8' },
                          { front: '#fb923c', side: '#ea580c', top: '#fdba74' },
                          { front: '#f472b6', side: '#db2777', top: '#f9a8d4' },
                          { front: '#f59e0b', side: '#b45309', top: '#fbbf24' },
                          { front: '#ef4444', side: '#b91c1c', top: '#f87171' }
                        ]
                        const c = palette[Math.abs(Number(d.label.replace('/', ''))) % palette.length] || palette[0]

                        const showH = d.value > 0 ? Math.max(8, hPx) : 0
                        return (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => {
                              setDiaSelecionado(d.key)
                              const doDia = ultimasEntregas.filter((m) => {
                                if (!m.timestamp) return false
                                const dia = new Date(m.timestamp).toISOString().slice(0, 10)
                                return dia === d.key
                              })
                              setEntregasDoDia(doDia)
                            }}
                            className="flex flex-col items-center gap-2 w-[44px] rounded-xl hover:bg-white/60 transition-colors p-1"
                            title={`Ver entregas de ${d.label}`}
                          >
                            <div className="w-full h-28 flex items-end justify-center">
                              <div className="relative w-[30px]">
                                <div className="absolute -bottom-1 left-0 right-0 h-2 rounded-full bg-slate-200/70" />
                                <div className="relative" style={{ height: 112 }}>
                                  {d.value > 0 ? (
                                    <>
                                      <div
                                        className="absolute left-1/2 -translate-x-1/2 text-[11px] font-extrabold text-slate-900"
                                        style={{ top: 112 - showH - 18 }}
                                      >
                                        {d.value}
                                      </div>

                                      <div
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-sm"
                                        style={{ width: 22, height: showH, background: c.front }}
                                      />
                                      <div
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom"
                                        style={{
                                          width: 8,
                                          height: showH,
                                          background: c.side,
                                          transform: 'translateX(11px) skewY(-22deg)',
                                          borderRadius: 2
                                        }}
                                      />
                                      <div
                                        className="absolute left-1/2 -translate-x-1/2"
                                        style={{
                                          width: 22,
                                          height: 8,
                                          background: c.top,
                                          transform: `translateY(${112 - showH - 4}px) skewX(-35deg) translateX(4px)`,
                                          borderRadius: 2
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400">0</div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] font-semibold text-slate-500">{d.label}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      </div>

      {/* Modal de entregas do dia */}
      {diaSelecionado && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 transition-opacity"
            onClick={() => setDiaSelecionado(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col pointer-events-auto transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header com gradiente e ícone grande */}
              <div className="relative px-6 py-5 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 rounded-t-3xl">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-t-3xl" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <Calendar size={28} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-white">
                        Entregas do dia
                      </h2>
                      <p className="text-sky-100 font-semibold">
                        {new Date(`${diaSelecionado}T00:00:00`).toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDiaSelecionado(null)}
                    className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors flex items-center justify-center shadow-lg"
                    aria-label="Fechar"
                    title="Fechar"
                  >
                    <X size={24} />
                  </button>
                </div>
                {/* Badge com contador */}
                <div className="absolute -bottom-4 left-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-slate-200">
                    <Package size={16} className="text-sky-600" />
                    <span className="text-sm font-extrabold text-slate-900">
                      {entregasDoDia.length} entrega{entregasDoDia.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-6 pt-8 pb-6">
                  {entregasDoDia.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Package size={36} className="text-slate-400" />
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mb-1">
                        Nenhuma entrega neste dia
                      </h3>
                      <p className="text-sm text-slate-500">
                        Não há movimentações registradas para esta data.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {entregasDoDia.map((m, idx) => (
                        <div
                          key={m.uid}
                          className="group rounded-xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 p-4 hover:shadow-md hover:border-sky-200/60 transition-all duration-200"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Cabeçalho com porta e ação */}
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 rounded-lg">
                                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                  <span className="text-xs font-extrabold text-white">
                                    Porta {m.numero_porta || '—'}
                                  </span>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
                                  m.acao === 'OCUPAR'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm'
                                    : m.acao === 'LIBERAR'
                                      ? 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 shadow-sm'
                                }`}>
                                  {m.acao === 'OCUPAR' ? 'Ocupar' : m.acao === 'LIBERAR' ? 'Liberar' : m.acao || '—'}
                                </span>
                              </div>

                              {/* Destinos */}
                              <div className="mb-2">
                                {(() => {
                                  const destinos = destinosMovimentacaoComFallback(m)
                                  if (destinos.length === 0) {
                                    return (
                                      <p className="text-xs text-slate-600 font-medium">
                                        Destino: —
                                      </p>
                                    )
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-1.5">
                                      {destinos.map((d, i) => (
                                        <div
                                          key={`${d.bloco}-${d.apartamento}-${i}`}
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm"
                                        >
                                          <Building2 size={10} className="text-slate-500" />
                                          <span>
                                            {d.bloco ? `Bloco ${d.bloco}` : 'Bloco —'} • {d.apartamento ? `Apt ${d.apartamento}` : 'Apt —'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                })()}
                              </div>

                              {/* Horário */}
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                <Clock size={10} className="text-slate-400" />
                                {formatarData(m.timestamp || null)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
