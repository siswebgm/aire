import { useEffect, useState, useCallback } from 'react'
import {
  Building2, 
  DoorOpen,
  DoorClosed,
  Package,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Key,
  Copy,
  Check,
  Users,
  X,
  AlertCircle,
  RotateCcw,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react'
import type { Gaveteiro, Porta, StatusPorta, Bloco, Apartamento } from '../../types/gaveteiro'
import { listarPortas, ocuparPorta, liberarPortaComSenha, cancelarOcupacao, listarBlocos, listarApartamentos, solicitarAberturaPortaIot, aguardarConclusaoComandoIot, buscarUltimoStatusIotPorComando, abrirPortaEsp32, fecharPortaEsp32, atualizarStatusFechaduraPorNumero, atualizarSensorImaPorNumero, type Destinatario, type SenhaDestinatario } from '../../services/gaveteiroService'
import { supabase } from '../../lib/supabaseClient'

// Token padrão ESP32 (em produção, use variável de ambiente)
const ESP32_DEFAULT_TOKEN = process.env.NEXT_PUBLIC_ESP32_DEFAULT_TOKEN || null

// Log de versão
console.log('🟢 [VERSÃO] GaveteiroCompacto v5.1 - +24h NAS PORTAS DISPONÍVEIS')

interface GaveteiroCompactoProps {
  gaveteiro: Gaveteiro
  condominioUid: string
}

function calcularTempoDecorrido(dataInicio?: string): string {
  if (!dataInicio) return ''
  
  const inicio = new Date(dataInicio)
  const agora = new Date()
  const diffMs = agora.getTime() - inicio.getTime()
  
  const minutos = Math.floor(diffMs / 60000)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)
  
  if (dias > 0) return `${dias}d`
  if (horas > 0) return `${horas}h`
  return `${minutos}m`
}

function getStatusColor(status: StatusPorta) {
  switch (status) {
    case 'DISPONIVEL':
      return { bg: 'bg-green-500', border: 'border-green-500', text: 'text-white' }
    case 'OCUPADO':
    default:
      return { bg: 'bg-red-500', border: 'border-red-500', text: 'text-white' }
  }
}

// Formatar destinatários agrupando por bloco
function formatarDestinatariosAgrupados(blocoAtual?: string, apartamentoAtual?: string): { bloco: string, apartamentos: string[] }[] {
  if (!blocoAtual || !apartamentoAtual) return []
  
  const blocos = blocoAtual.split(', ')
  const apartamentos = apartamentoAtual.split(', ')
  
  // Agrupar apartamentos por bloco
  const grupos: Record<string, string[]> = {}
  
  blocos.forEach((bloco, index) => {
    const apto = apartamentos[index] || ''
    if (!grupos[bloco]) grupos[bloco] = []
    if (apto && !grupos[bloco].includes(apto)) {
      grupos[bloco].push(apto)
    }
  })
  
  return Object.entries(grupos).map(([bloco, apts]) => ({
    bloco,
    apartamentos: apts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }))
}

function PortaMini({ 
  porta, 
  deviceId,
  condominioUid,
  gaveteiroUid,
  onUpdate,
  esp32Online,
  checkingConnection,
  esp32Ip,
  esp32Token 
}: { 
  porta: Porta
  deviceId: string
  condominioUid: string
  gaveteiroUid: string
  onUpdate: () => void
  esp32Online: boolean | null
  checkingConnection: boolean
  esp32Ip?: string
  esp32Token?: string 
}) {
  // Bloquear ocupação se offline, verificando ou ainda não verificou
  const podeOcupar = esp32Online === true && !checkingConnection
  
  // URL base do ESP32 deste gaveteiro (usa proxy para evitar CORS)
  const ESP32_BASE_URL = esp32Ip ? '/esp32' : null
  const ESP32_TOKEN = esp32Token || ESP32_DEFAULT_TOKEN
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState<'info' | 'ocupar' | 'liberar' | 'sucesso' | 'cancelar'>('info')
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [loadingCancelamento, setLoadingCancelamento] = useState(false)
  const [ocupacaoSucesso, setOcupacaoSucesso] = useState(false)
  const [iotOpeningStatus, setIotOpeningStatus] = useState<'idle' | 'sending' | 'waiting' | 'open' | 'closed' | 'error' | 'timeout'>('idle')
  const [iotOpeningError, setIotOpeningError] = useState<string>('')
  
  // Dados de blocos e apartamentos cadastrados
  const [blocosDisponiveis, setBlocosDisponiveis] = useState<Bloco[]>([])
  const [apartamentosDisponiveis, setApartamentosDisponiveis] = useState<Apartamento[]>([])
  
  // Estado para ocupação - Múltiplos blocos, cada um com múltiplos apartamentos
  interface GrupoBloco {
    blocoUid: string
    blocoNome: string
    apartamentos: string[] // números dos apartamentos
    filtro: string // filtro de busca
  }
  const [grupos, setGrupos] = useState<GrupoBloco[]>([{ blocoUid: '', blocoNome: '', apartamentos: [], filtro: '' }])
  const [senhasGeradas, setSenhasGeradas] = useState<SenhaDestinatario[]>([])
  const [copiado, setCopiado] = useState<string | null>(null)
  
  // Estado para liberação
  const [senhaDigitada, setSenhaDigitada] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  
  const colors = getStatusColor(porta.status_atual)
  const tempoOcupado = porta.ocupado_em ? calcularTempoDecorrido(porta.ocupado_em) : ''
  const destinatariosAgrupados = formatarDestinatariosAgrupados(porta.bloco_atual, porta.apartamento_atual)

  const resetModal = () => {
    setModalStep('info')
    setGrupos([{ blocoUid: '', blocoNome: '', apartamentos: [], filtro: '' }])
    setSenhasGeradas([])
    setSenhaDigitada('')
    setMotivoCancelamento('')
    setLoadingCancelamento(false)
    setErroSenha('')
    setCopiado(null)
    setOcupacaoSucesso(false)
    setIotOpeningStatus('idle')
    setIotOpeningError('')
  }

  useEffect(() => {
    if (ocupacaoSucesso && modalStep !== 'sucesso') {
      setModalStep('sucesso')
    }
  }, [ocupacaoSucesso, modalStep])

  // Carregar blocos e apartamentos ao abrir modal
  const carregarDados = async () => {
    try {
      const [blocos, apartamentos] = await Promise.all([
        listarBlocos(condominioUid),
        listarApartamentos(condominioUid)
      ])
      setBlocosDisponiveis(blocos)
      setApartamentosDisponiveis(apartamentos)
    } catch (err) {
      console.error('Erro ao carregar blocos/apartamentos:', err)
    }
  }

  const abrirModal = () => {
    resetModal()
    carregarDados()
    setShowModal(true)
  }

  const fecharModal = () => {
    setShowModal(false)
    resetModal()
  }

  // Fechar porta fisicamente (sem ocupação - apenas trancar)
  const handleFecharPortaFisica = async () => {
    if (!ESP32_BASE_URL || !ESP32_TOKEN) return
    
    setLoading(true)
    try {
      console.log('[ESP32] Enviando comando FECHAR porta', porta.numero_porta)
      await fecharPortaEsp32({
        baseUrl: ESP32_BASE_URL,
        token: ESP32_TOKEN,
        numeroPorta: porta.numero_porta,
        timeoutMs: 10000
      })
      console.log('[ESP32] Porta', porta.numero_porta, 'FECHADA com sucesso!')
      
      // REGISTRAR STATUS DA FECHADURA NO BANCO
      try {
        await atualizarStatusFechaduraPorNumero(
          gaveteiroUid,
          porta.numero_porta,
          'fechada'
        )
        console.log('[DB] Status da fechadura registrado: FECHADA')
      } catch (dbErr) {
        console.error('[DB] Erro ao registrar status:', dbErr)
      }
      
      onUpdate()
    } catch (err: any) {
      console.error('[ESP32] Erro ao fechar porta:', err)
      alert('Erro ao fechar porta: ' + (err.message || 'Falha na comunicação'))
    } finally {
      setLoading(false)
    }
  }

  // Funções para gerenciar grupos de blocos/apartamentos
  const adicionarGrupo = () => {
    setGrupos([...grupos, { blocoUid: '', blocoNome: '', apartamentos: [], filtro: '' }])
  }

  const removerGrupo = (grupoIndex: number) => {
    if (grupos.length > 1) {
      setGrupos(grupos.filter((_, i) => i !== grupoIndex))
    }
  }

  const selecionarBloco = (grupoIndex: number, blocoUid: string) => {
    const novos = [...grupos]
    const bloco = blocosDisponiveis.find(b => b.uid === blocoUid)
    novos[grupoIndex].blocoUid = blocoUid
    novos[grupoIndex].blocoNome = bloco?.nome || ''
    novos[grupoIndex].apartamentos = []
    novos[grupoIndex].filtro = ''
    setGrupos(novos)
  }

  const atualizarFiltro = (grupoIndex: number, filtro: string) => {
    const novos = [...grupos]
    novos[grupoIndex].filtro = filtro
    setGrupos(novos)
  }

  const toggleApartamento = (grupoIndex: number, numero: string) => {
    const novos = [...grupos]
    const apts = novos[grupoIndex].apartamentos
    if (apts.includes(numero)) {
      novos[grupoIndex].apartamentos = apts.filter(a => a !== numero)
    } else {
      novos[grupoIndex].apartamentos = [...apts, numero]
    }
    setGrupos(novos)
  }

  const selecionarTodos = (grupoIndex: number) => {
    const novos = [...grupos]
    const aptsDoBloco = getApartamentosDoBloco(novos[grupoIndex].blocoUid)
    const filtrados = aptsDoBloco.filter(a => 
      !novos[grupoIndex].filtro || a.numero.includes(novos[grupoIndex].filtro)
    )
    novos[grupoIndex].apartamentos = filtrados.map(a => a.numero)
    setGrupos(novos)
  }

  const limparSelecao = (grupoIndex: number) => {
    const novos = [...grupos]
    novos[grupoIndex].apartamentos = []
    setGrupos(novos)
  }

  // Filtrar apartamentos por bloco e termo de busca
  const getApartamentosDoBloco = (blocoUid: string) => {
    return apartamentosDisponiveis.filter(a => a.bloco_uid === blocoUid)
  }

  const getApartamentosFiltrados = (blocoUid: string, filtro: string) => {
    const apts = getApartamentosDoBloco(blocoUid)
    if (!filtro) return apts
    return apts.filter(a => a.numero.toLowerCase().includes(filtro.toLowerCase()))
  }

  // Ocupar porta
  const handleOcupar = async () => {
    console.log('🔵 VERSÃO ATUALIZADA - handleOcupar iniciado')
    console.log('🔵 ESP32_BASE_URL:', ESP32_BASE_URL)
    console.log('🔵 ESP32_TOKEN:', ESP32_TOKEN)
    
    // Converter grupos para destinatários
    const destinatarios: Destinatario[] = []
    
    for (const grupo of grupos) {
      if (!grupo.blocoNome) continue
      
      for (const apto of grupo.apartamentos) {
        destinatarios.push({
          bloco: grupo.blocoNome,
          apartamento: apto
        })
      }
    }

    if (destinatarios.length === 0) {
      setErroSenha('Selecione pelo menos um bloco e apartamento')
      return
    }

    setLoading(true)
    setErroSenha('')
    setOcupacaoSucesso(false)
    try {
      const resultado = await ocuparPorta({
        portaUid: porta.uid,
        condominioUid,
        destinatarios
      })
      
      // Cada destinatário tem sua própria senha
      setSenhasGeradas(resultado.senhas)

      // Mostrar sucesso imediatamente e acompanhar IoT em background
      setOcupacaoSucesso(true)
      setModalStep('sucesso')
      onUpdate()

      ;(async () => {
        try {
          setIotOpeningStatus('sending')
          setIotOpeningError('')

          // Debug: Verificar configuração do ESP32 deste gaveteiro
          console.log('[DEBUG] ESP32_BASE_URL:', ESP32_BASE_URL)
          console.log('[DEBUG] ESP32_TOKEN:', ESP32_TOKEN)

          // Usar comunicação HTTP direta com ESP32
          if (ESP32_BASE_URL && ESP32_TOKEN) {
            try {
              // Abrir a porta (mantém aberta até comando de fechar)
              console.log('[ESP32] Enviando comando ABRIR porta', porta.numero_porta)
              await abrirPortaEsp32({
                baseUrl: ESP32_BASE_URL,
                token: ESP32_TOKEN,
                numeroPorta: porta.numero_porta,  // CORRIGIDO: passar numero da porta
                timeoutMs: 10000
              })
              console.log('[ESP32] Porta', porta.numero_porta, 'ABERTA com sucesso!')
              setIotOpeningStatus('open')
              
              // REGISTRAR STATUS DA FECHADURA NO BANCO
              try {
                await atualizarStatusFechaduraPorNumero(
                  gaveteiroUid,
                  porta.numero_porta,
                  'aberta'
                )
                console.log('[DB] Status da fechadura registrado: ABERTA')
              } catch (dbErr) {
                console.error('[DB] Erro ao registrar status:', dbErr)
              }
            } catch (err: any) {
              console.error('[ESP32] Erro na comunicação:', err)
              setIotOpeningStatus('error')
              setIotOpeningError(err.message || 'Falha ao comunicar com ESP32. Verifique se está ligado e acessível.')
            }
            return
          }

          // Fallback: Sistema IoT via Supabase (apenas se ESP32 não configurado)
          console.log('[IoT] ESP32 não configurado, tentando sistema IoT via Supabase...')
          
          try {
            const comando = await solicitarAberturaPortaIot({
              deviceId,
              portaNumero: porta.numero_porta,
              pulseMs: 800
            })

            setIotOpeningStatus('waiting')

            const concluido = await aguardarConclusaoComandoIot(comando.uid, { timeoutMs: 12000, intervalMs: 600 })
            if (concluido.status === 'ERROR') {
              setIotOpeningStatus('error')
              setIotOpeningError(concluido.erro || 'Falha ao abrir')
              return
            }

            if (concluido.status === 'DONE') {
              const st = await buscarUltimoStatusIotPorComando(concluido.uid)
              if (st?.door_state === 'OPEN') setIotOpeningStatus('open')
              else if (st?.door_state === 'CLOSED') setIotOpeningStatus('closed')
              else setIotOpeningStatus('timeout')
              return
            }

            setIotOpeningStatus('timeout')
          } catch (err: any) {
            console.error('[IoT] Erro ao usar sistema IoT:', err)
            setIotOpeningStatus('error')
            setIotOpeningError('Sistema IoT não disponível. Configure ESP32 no .env')
          }
        } catch (err) {
          console.error('[ERRO GERAL] Falha no processo de abertura:', err)
          setIotOpeningStatus('error')
          setIotOpeningError('Erro inesperado ao processar comando')
        }
      })()
    } catch (err: any) {
      console.error('Erro ao ocupar:', err)
      setErroSenha(err.message || 'Erro ao ocupar porta')
    } finally {
      setLoading(false)
    }
  }

  // Liberar porta com senha
  const handleLiberar = async () => {
    if (!senhaDigitada.trim()) {
      setErroSenha('Digite a senha')
      return
    }

    setLoading(true)
    setErroSenha('')
    try {
      const resultado = await liberarPortaComSenha(
        porta.uid,
        condominioUid,
        senhaDigitada
      )
      
      if (resultado.sucesso) {
        // Enviar comando FECHAR para o ESP32
        if (ESP32_BASE_URL && ESP32_TOKEN) {
          try {
            console.log('[ESP32] Enviando comando FECHAR...')
            await fecharPortaEsp32({
              baseUrl: ESP32_BASE_URL,
              token: ESP32_TOKEN,
              numeroPorta: porta.numero_porta,
              timeoutMs: 10000
            })
            console.log('[ESP32] Porta FECHADA com sucesso!')
            
            // REGISTRAR STATUS DA FECHADURA NO BANCO
            try {
              await atualizarStatusFechaduraPorNumero(
                gaveteiroUid,
                porta.numero_porta,
                'fechada'
              )
              console.log('[DB] Status da fechadura registrado: FECHADA')
            } catch (dbErr) {
              console.error('[DB] Erro ao registrar status:', dbErr)
            }
          } catch (err: any) {
            console.error('[ESP32] Erro ao fechar:', err)
            // Não bloqueia a liberação se o ESP32 falhar
          }
        }
        fecharModal()
        onUpdate()
      } else {
        setErroSenha(resultado.mensagem)
      }
    } catch (err: any) {
      console.error('Erro ao liberar:', err)
      setErroSenha(err.message || 'Erro ao liberar porta')
    } finally {
      setLoading(false)
    }
  }

  // Copiar senha específica
  const copiarSenha = (senha: string) => {
    navigator.clipboard.writeText(senha)
    setCopiado(senha)
    setTimeout(() => setCopiado(null), 2000)
  }

  // Copiar todas as senhas
  const copiarTodasSenhas = () => {
    const texto = senhasGeradas.map(s => `${s.bloco} - Apto ${s.apartamento}: ${s.senha}`).join('\n')
    navigator.clipboard.writeText(texto)
    setCopiado('todas')
    setTimeout(() => setCopiado(null), 2000)
  }

  // Tooltip com tempo ocupado
  const tooltip = porta.status_atual === 'OCUPADO' 
    ? `${porta.bloco_atual || ''} - Apto ${porta.apartamento_atual || ''} (${tempoOcupado})` 
    : 'Disponível - Clique para ocupar'

  return (
    <>
      <button
        onClick={abrirModal}
        className={`
          w-full aspect-square rounded-xl ${colors.bg} ${colors.text}
          flex flex-col items-center justify-center relative
          font-bold transition-all duration-200 
          hover:scale-105 hover:shadow-xl hover:z-10
          shadow-md text-lg group
          ${porta.status_atual === 'DISPONIVEL' 
            ? 'hover:ring-2 hover:ring-green-300 hover:ring-offset-2' 
            : 'hover:ring-2 hover:ring-red-300 hover:ring-offset-2'}
        `}
        title={tooltip}
      >
        {/* Ícone pequeno para ocupados */}
        {porta.status_atual === 'OCUPADO' && (
          <Package size={12} className="absolute top-1 left-1 opacity-60" />
        )}
        
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold">{porta.numero_porta}</span>
          {porta.status_atual === 'DISPONIVEL' && (
            <span className="text-xs text-yellow-300 mt-1 font-bold">+24h</span>
          )}
        </div>
        
        {/* Indicador de compartilhada */}
        {porta.compartilhada && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-500 rounded-full 
                        flex items-center justify-center shadow-md border-2 border-white">
            <Users size={10} className="text-white" />
          </div>
        )}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-white/40 flex flex-col">
            {/* Header */}
            <div
              className={`relative text-white p-5 ${
                porta.status_atual === 'DISPONIVEL'
                  ? 'bg-gradient-to-br from-emerald-600 via-green-600 to-teal-500'
                  : 'bg-gradient-to-br from-rose-600 via-red-600 to-orange-500'
              }`}
            >
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.35),transparent_40%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20 shadow-sm">
                    <Package size={22} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-xl leading-tight">Porta {porta.numero_porta}</h3>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          porta.status_atual === 'DISPONIVEL'
                            ? 'bg-white/15 border-white/25'
                            : 'bg-white/15 border-white/25'
                        }`}
                      >
                        {porta.status_atual === 'DISPONIVEL' ? 'DISPONÍVEL' : 'OCUPADO'}
                      </span>
                    </div>
                    <p className="text-sm text-white/85 mt-1 truncate">
                      {porta.status_atual === 'DISPONIVEL'
                        ? 'Pronta para uso'
                        : destinatariosAgrupados.length > 0
                          ? destinatariosAgrupados.map(g => `${g.bloco}: ${g.apartamentos.join(', ')}`).join(' | ')
                          : 'Ocupado'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={fecharModal}
                  className="p-2 rounded-full hover:bg-white/15 transition-colors text-white/90 hover:text-white"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conteúdo baseado no step */}
            {modalStep === 'info' && (
              <>
                <div className="flex-1 overflow-y-auto">
                  {/* Dados */}
                  <div className="p-5 space-y-4">
                  
                  {/* Destinatários agrupados por bloco */}
                  {porta.status_atual === 'OCUPADO' && destinatariosAgrupados.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-gray-500">Destinatários</span>
                      <div className="space-y-2">
                        {destinatariosAgrupados.map((grupo, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                <Building2 size={14} className="text-blue-600" />
                              </div>
                              <span className="font-semibold text-gray-900">{grupo.bloco}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {grupo.apartamentos.map((apto, i) => (
                                <span key={i} className="px-2.5 py-1 bg-white text-blue-700 border border-blue-100 rounded-lg text-xs font-semibold">
                                  {apto}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {porta.status_atual === 'OCUPADO' && porta.ocupado_em && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ocupado em</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {new Date(porta.ocupado_em).toLocaleString('pt-BR')}
                        </p>
                      </div>

                      {tempoOcupado && (
                        <div className="bg-red-50 rounded-2xl p-3 border border-red-100">
                          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Tempo ocupado</p>
                          <p className="mt-1 text-sm font-extrabold text-red-700">{tempoOcupado}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {porta.status_atual === 'OCUPADO' && porta.compartilhada && (
                    <div className="flex items-center gap-2 text-sm bg-purple-50 text-purple-700 p-3 rounded-2xl border border-purple-100">
                      <div className="w-8 h-8 rounded-xl bg-white border border-purple-100 flex items-center justify-center">
                        <Users size={16} />
                      </div>
                      <span className="font-medium">Porta compartilhada ({destinatariosAgrupados.reduce((acc, g) => acc + g.apartamentos.length, 0)} destinatários)</span>
                    </div>
                  )}
                  </div>
                </div>

                {/* Ações */}
                <div className="p-5 bg-gray-50 border-t space-y-3">
                  {/* Status de conexão ESP32 */}
                  {porta.status_atual === 'DISPONIVEL' && (
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                      checkingConnection 
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : podeOcupar 
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {checkingConnection ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <div>
                            <p className="font-semibold text-sm">Verificando conexão...</p>
                            <p className="text-xs opacity-80">Aguarde para ocupar a porta</p>
                          </div>
                        </>
                      ) : podeOcupar ? (
                        <>
                          <Wifi size={18} />
                          <div>
                            <p className="font-semibold text-sm">Gaveteiro Online</p>
                            <p className="text-xs opacity-80">Pronto para ocupar</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <WifiOff size={18} />
                          <div>
                            <p className="font-semibold text-sm">Gaveteiro Offline</p>
                            <p className="text-xs opacity-80">Não é possível ocupar portas</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {porta.status_atual === 'DISPONIVEL' ? (
                      <>
                        <button
                          onClick={() => setModalStep('ocupar')}
                          disabled={!podeOcupar}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                                   text-white rounded-xl font-semibold shadow-sm transition-all
                                   ${!podeOcupar 
                                     ? 'bg-gray-400 cursor-not-allowed' 
                                     : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700'}`}
                        >
                          {checkingConnection && <Loader2 size={16} className="animate-spin" />}
                          {!checkingConnection && <Package size={16} />}
                          {checkingConnection ? 'Aguarde...' : 'Ocupar'}
                        </button>
                        
                      </>
                    ) : (
                      <button
                        onClick={() => setModalStep('liberar')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                                 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 font-semibold shadow-sm"
                      >
                        <Key size={16} />
                        Liberar com Senha
                      </button>
                    )}
                    
                    <button
                      onClick={fecharModal}
                      className="px-4 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-100 font-semibold border border-gray-200 shadow-sm"
                    >
                      Fechar
                    </button>
                  </div>
                  
                  {/* Botão Cancelar Ocupação */}
                  {porta.status_atual === 'OCUPADO' && (
                    <button
                      onClick={() => setModalStep('cancelar')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 
                               bg-transparent text-gray-500 rounded-xl 
                               hover:bg-gray-100 hover:text-gray-700 text-sm font-medium
                               border border-transparent"
                    >
                      <RotateCcw size={14} className="opacity-80" />
                      Registrou errado? Cancelar ocupação
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Step: Ocupar */}
            {modalStep === 'ocupar' && (
              <>
                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                  {/* Grupos de Bloco + Apartamentos */}
                  {grupos.map((grupo, grupoIndex) => {
                    const todosAptos = getApartamentosDoBloco(grupo.blocoUid)
                    const aptosFiltrados = getApartamentosFiltrados(grupo.blocoUid, grupo.filtro)
                    
                    return (
                      <div key={grupoIndex} className="bg-gray-50 rounded-xl p-3 border">
                        {/* Header: Select Bloco + Remover */}
                        <div className="flex items-center gap-2 mb-3">
                          <select
                            value={grupo.blocoUid}
                            onChange={(e) => selecionarBloco(grupoIndex, e.target.value)}
                            className="flex-1 px-4 py-3 border-2 rounded-xl text-base font-bold bg-white
                                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Selecione o Bloco</option>
                            {blocosDisponiveis.map(bloco => (
                              <option key={bloco.uid} value={bloco.uid}>
                                {bloco.nome} ({getApartamentosDoBloco(bloco.uid).length} aptos)
                              </option>
                            ))}
                          </select>

                          {grupos.length > 1 && (
                            <button
                              onClick={() => removerGrupo(grupoIndex)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Remover bloco"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>

                        {/* Apartamentos */}
                        {grupo.blocoUid && todosAptos.length > 0 && (
                          <>
                            {/* Ações rápidas */}
                            <div className="flex items-center gap-2 mb-3">
                              {todosAptos.length > 20 && (
                                <input
                                  type="text"
                                  value={grupo.filtro}
                                  onChange={(e) => atualizarFiltro(grupoIndex, e.target.value)}
                                  placeholder="Buscar..."
                                  className="flex-1 px-3 py-2 border-2 rounded-lg text-sm"
                                />
                              )}
                              <button
                                onClick={() => selecionarTodos(grupoIndex)}
                                className="px-3 py-2 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 font-medium"
                              >
                                Todos
                              </button>
                              <button
                                onClick={() => limparSelecao(grupoIndex)}
                                className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium"
                              >
                                Limpar
                              </button>
                            </div>

                            {/* Grid de apartamentos com scroll */}
                            <div className={`flex flex-wrap gap-2 ${todosAptos.length > 30 ? 'max-h-40 overflow-y-auto p-1' : ''}`}>
                              {aptosFiltrados.map(apto => (
                                <button
                                  key={apto.uid}
                                  onClick={() => toggleApartamento(grupoIndex, apto.numero)}
                                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                                    ${grupo.apartamentos.includes(apto.numero)
                                      ? 'bg-blue-500 text-white shadow-md'
                                      : 'bg-white border-2 text-gray-600 hover:border-blue-400'
                                    }`}
                                >
                                  {apto.numero}
                                </button>
                              ))}
                            </div>

                            {/* Info de filtro */}
                            {grupo.filtro && (
                              <p className="mt-1 text-xs text-gray-400">
                                Mostrando {aptosFiltrados.length} de {todosAptos.length}
                              </p>
                            )}
                          </>
                        )}

                        {grupo.blocoUid && todosAptos.length === 0 && (
                          <p className="text-xs text-gray-400 italic">
                            Nenhum apartamento cadastrado neste bloco
                          </p>
                        )}
                        
                        {/* Resumo dos selecionados */}
                        {grupo.apartamentos.length > 0 && (
                          <div className="mt-2 text-xs text-blue-600 font-medium">
                            {grupo.apartamentos.length} selecionado(s): {grupo.apartamentos.slice(0, 10).join(', ')}
                            {grupo.apartamentos.length > 10 && ` +${grupo.apartamentos.length - 10}`}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Botão adicionar bloco */}
                  <button
                    onClick={adicionarGrupo}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl
                             text-gray-500 hover:border-blue-400 hover:text-blue-600 
                             flex items-center justify-center gap-2 text-base font-medium transition-colors"
                  >
                    <Plus size={18} />
                    Adicionar outro bloco
                  </button>
                  
                  {/* Contador de destinatários */}
                  {(() => {
                    const total = grupos.reduce((acc, g) => acc + g.apartamentos.length, 0)
                    return total > 1 ? (
                      <div className="flex items-center gap-2 text-sm bg-purple-50 text-purple-700 p-2 rounded-lg">
                        <Users size={16} />
                        <span>Porta será compartilhada ({total} destinatários)</span>
                      </div>
                    ) : null
                  })()}

                  {erroSenha && (
                    <div className="flex items-center gap-2 text-sm bg-red-50 text-red-700 p-2 rounded-lg">
                      <AlertCircle size={16} />
                      <span>{erroSenha}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex gap-2">
                  <button
                    onClick={() => setModalStep('info')}
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleOcupar}
                    disabled={loading || !grupos.some(g => g.blocoUid && g.apartamentos.length > 0)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                             bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium
                             disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                    Confirmar Ocupação
                  </button>
                </div>
              </>
            )}

            {/* Step: Liberar */}
            {modalStep === 'liberar' && (
              <>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Digite a senha para liberar
                    </label>
                    <input
                      type="text"
                      value={senhaDigitada}
                      onChange={(e) => {
                        setSenhaDigitada(e.target.value)
                        setErroSenha('')
                      }}
                      placeholder="Senha provisória ou mestre"
                      className="w-full px-4 py-3 border rounded-lg text-center text-2xl font-mono tracking-widest
                               focus:ring-2 focus:ring-green-500"
                      maxLength={10}
                      autoFocus
                    />
                  </div>
                  
                  <p className="text-xs text-gray-500 text-center">
                    Use a senha provisória fornecida ao ocupar ou a senha mestre do condomínio
                  </p>

                  {erroSenha && (
                    <div className="flex items-center justify-center gap-2 text-sm bg-red-50 text-red-700 p-2 rounded-lg">
                      <AlertCircle size={16} />
                      <span>{erroSenha}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex gap-2">
                  <button
                    onClick={() => {
                      setModalStep('info')
                      setSenhaDigitada('')
                      setErroSenha('')
                    }}
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleLiberar}
                    disabled={loading || !senhaDigitada.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                             bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium
                             disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <DoorOpen size={16} />}
                    Liberar Porta
                  </button>
                </div>
              </>
            )}

            {/* Step: Cancelar Ocupação */}
            {modalStep === 'cancelar' && (
              <>
                <div className="p-4 space-y-4">
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-3">
                      <AlertTriangle size={28} className="text-amber-600" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Cancelar Ocupação</h4>
                    <p className="text-sm text-gray-500">
                      Isso irá liberar a porta e invalidar todas as senhas geradas
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-amber-800 text-sm">
                      <strong>Atenção:</strong> Use esta opção apenas se a ocupação foi registrada por engano. 
                      As senhas geradas serão canceladas.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo do cancelamento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={motivoCancelamento}
                      onChange={(e) => setMotivoCancelamento(e.target.value)}
                      className={`w-full px-4 py-3 border-2 rounded-xl text-sm bg-white
                               focus:ring-2 focus:ring-amber-500 focus:border-amber-500
                               ${!motivoCancelamento ? 'border-amber-300' : 'border-gray-200'}`}
                    >
                      <option value="">Selecione o motivo...</option>
                      <option value="Bloco/Apartamento errado">Bloco/Apartamento errado</option>
                      <option value="Porta errada">Porta errada</option>
                      <option value="Destinatário incorreto">Destinatário incorreto</option>
                      <option value="Entrega cancelada">Entrega cancelada</option>
                      <option value="Teste/Erro do sistema">Teste/Erro do sistema</option>
                      <option value="Outro">Outro motivo</option>
                    </select>
                  </div>

                  {erroSenha && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle size={16} />
                      {erroSenha}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex gap-2">
                  <button
                    onClick={() => {
                      setModalStep('info')
                      setMotivoCancelamento('')
                      setErroSenha('')
                    }}
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={async () => {
                      setLoadingCancelamento(true)
                      setErroSenha('')
                      try {
                        const resultado = await cancelarOcupacao(
                          porta.uid,
                          condominioUid,
                          motivoCancelamento || 'Não informado'
                        )
                        if (resultado.sucesso) {
                          onUpdate()
                          fecharModal()
                        } else {
                          setErroSenha(resultado.mensagem)
                        }
                      } catch (err) {
                        setErroSenha('Erro ao cancelar ocupação')
                      } finally {
                        setLoadingCancelamento(false)
                      }
                    }}
                    disabled={loadingCancelamento || !motivoCancelamento}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                             bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingCancelamento ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Cancelando...
                      </>
                    ) : (
                      <>
                        <RotateCcw size={16} />
                        Confirmar Cancelamento
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Step: Sucesso */}
            {modalStep === 'sucesso' && (
              <>
                <div className="p-4 space-y-4">
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <Check size={28} className="text-green-600" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Ocupação confirmada com sucesso!</h4>
                    <p className="text-sm text-gray-500">
                      Operação realizada com sucesso.
                    </p>
                  </div>

                  {iotOpeningStatus === 'sending' || iotOpeningStatus === 'waiting' ? (
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0">
                        <Loader2 size={18} className="text-blue-700 animate-spin" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-blue-900">Abrindo a porta...</p>
                        <p className="text-blue-800/90">
                          Aguarde a confirmação do dispositivo.
                        </p>
                      </div>
                    </div>
                  ) : iotOpeningStatus === 'open' ? (
                    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                        <DoorOpen size={18} className="text-emerald-700" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-emerald-900">A porta está aberta.</p>
                        <p className="text-emerald-800/90">
                          Você já pode depositar a encomenda no compartimento.
                        </p>
                      </div>
                    </div>
                  ) : iotOpeningStatus === 'closed' ? (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
                        <AlertTriangle size={18} className="text-amber-700" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-amber-900">A porta respondeu como fechada.</p>
                        <p className="text-amber-800/90">
                          Verifique a abertura física antes de depositar.
                        </p>
                      </div>
                    </div>
                  ) : iotOpeningStatus === 'timeout' ? (
                    <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <AlertCircle size={18} className="text-gray-700" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900">Comando enviado.</p>
                        <p className="text-gray-700">
                          Não foi possível confirmar o sensor a tempo. Se necessário, verifique a porta.
                        </p>
                      </div>
                    </div>
                  ) : iotOpeningStatus === 'error' ? (
                    <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-rose-200 flex items-center justify-center shrink-0">
                        <AlertCircle size={18} className="text-rose-700" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-rose-900">Não foi possível confirmar a abertura.</p>
                        <p className="text-rose-800/90">
                          {iotOpeningError || 'Verifique conexão do dispositivo.'}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  
                  {/* Lista de senhas por destinatário */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {senhasGeradas.map((s, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500 font-medium">
                              {s.bloco} - Apto {s.apartamento}
                            </p>
                            <p className="text-2xl font-mono font-bold tracking-widest text-gray-900">
                              {s.senha}
                            </p>
                          </div>
                          <button
                            onClick={() => copiarSenha(s.senha)}
                            className={`p-2 rounded-lg transition-colors ${
                              copiado === s.senha 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            title="Copiar senha"
                          >
                            {copiado === s.senha ? <Check size={18} /> : <Copy size={18} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {senhasGeradas.length > 1 && (
                    <button
                      onClick={copiarTodasSenhas}
                      className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                        copiado === 'todas'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {copiado === 'todas' ? '✓ Copiado!' : 'Copiar todas as senhas'}
                    </button>
                  )}
                  
                  <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs text-center">
                    <p className="font-medium">⚠️ IMPORTANTE</p>
                    <p>Cada senha só pode ser usada UMA vez.</p>
                    {senhasGeradas.length > 1 && (
                      <p className="mt-1">A porta só será liberada quando TODOS retirarem.</p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t">
                  <button
                    onClick={fecharModal}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Entendi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function GaveteiroCompacto({ gaveteiro, condominioUid }: GaveteiroCompactoProps) {
  const [portas, setPortas] = useState<Porta[]>([])
  const [loading, setLoading] = useState(true)
  const [esp32Online, setEsp32Online] = useState<boolean | null>(null)
  const [checkingConnection, setCheckingConnection] = useState(false)

  const carregarPortas = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const data = await listarPortas(gaveteiro.uid)
      setPortas(data)
    } catch (err) {
      console.error('Erro ao carregar portas:', err)
    } finally {
      if (!silencioso) setLoading(false)
    }
  }

  // Obter URL base do ESP32 deste gaveteiro
  // Usa proxy /esp32 para evitar CORS (configurado no next.config.js)
  const getEsp32Url = () => {
    if (gaveteiro.esp32_ip) {
      // Usar proxy do Next.js para evitar bloqueio CORS
      return '/esp32'
    }
    return null // Sem IP configurado
  }

  const getEsp32Token = () => {
    return gaveteiro.esp32_token || ESP32_DEFAULT_TOKEN
  }

  const verificarConexaoEsp32 = async () => {
    const baseUrl = getEsp32Url()
    
    // Se não tem IP configurado, marcar como offline
    if (!baseUrl) {
      console.log(`[ESP32] Gaveteiro ${gaveteiro.nome}: sem IP configurado`)
      setEsp32Online(false)
      return
    }

    setCheckingConnection(true)
    try {
      // Buscar status completo (inclui sensores) com timeout de 5 segundos
      console.log(`[ESP32] Verificando ${gaveteiro.nome}: ${baseUrl}/status`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const res = await fetch(`${baseUrl}/status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getEsp32Token()}` },
        signal: controller.signal,
        mode: 'cors'
      })
      
      clearTimeout(timeoutId)
      
      if (res.ok) {
        setEsp32Online(true)
        console.log(`[ESP32] ${gaveteiro.nome}: ONLINE`)
        
        // Tentar salvar status do sensor do ímã no banco
        try {
          const data = await res.json()
          console.log(`[ESP32] ${gaveteiro.nome} - Resposta:`, JSON.stringify(data))
          
          if (data.portas && Array.isArray(data.portas)) {
            console.log(`[ESP32] ${gaveteiro.nome} - ${data.portas.length} portas ESP32`)
            
            // Atualizar sensor_ima_status de cada porta DIRETO no banco
            // Não depende mais do estado local
            for (const portaEsp of data.portas) {
              const numeroPorta = Number(portaEsp?.numero ?? portaEsp?.porta)
              const estadoSensor = String(portaEsp?.sensor ?? portaEsp?.estado ?? '').toLowerCase()

              if (!Number.isFinite(numeroPorta)) {
                continue
              }

              let sensorImaStatus: 'aberto' | 'fechado' | 'desconhecido' = 'desconhecido'
              if (estadoSensor === 'fechado' || estadoSensor === 'fechada') {
                sensorImaStatus = 'fechado'
              } else if (estadoSensor === 'aberto' || estadoSensor === 'aberta') {
                sensorImaStatus = 'aberto'
              } else {
                continue
              }
              
              // Salvar direto no banco (a função vai fazer UPDATE)
              try {
                await atualizarSensorImaPorNumero(
                  gaveteiro.uid,
                  numeroPorta,
                  sensorImaStatus
                )
                console.log(`[SENSOR IMÃ] ✅ Porta ${numeroPorta}: ${sensorImaStatus}`)
              } catch (dbErr) {
                // Ignora erro silenciosamente (porta pode não existir)
              }
            }
          }
        } catch (jsonErr) {
          // Não é JSON válido, mas ESP32 está online
          console.log(`[ESP32] ${gaveteiro.nome}: erro ao parsear JSON:`, jsonErr)
        }
      } else {
        setEsp32Online(false)
        console.log(`[ESP32] ${gaveteiro.nome}: OFFLINE (status ${res.status})`)
      }
    } catch (err) {
      console.log(`[ESP32] ${gaveteiro.nome}: OFFLINE (erro de conexão)`)
      setEsp32Online(false)
    } finally {
      setCheckingConnection(false)
    }
  }

  useEffect(() => {
    // Carregar portas ao montar o componente
    carregarPortas()
    // Verificar conexão inicial após carregar portas
    const timer = setTimeout(() => verificarConexaoEsp32(), 500)
    
    // Supabase Realtime: atualização instantânea quando portas mudam
    const channel = supabase
      .channel(`portas-${gaveteiro.uid}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'cobrancas',
          table: 'gvt_portas',
          filter: `gaveteiro_uid=eq.${gaveteiro.uid}`
        },
        (payload) => {
          console.log('[REALTIME] Mudança detectada:', payload.eventType)
          carregarPortas(true) // Recarregar silenciosamente
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME] ${gaveteiro.nome}: ${status}`)
      })
    
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [gaveteiro.uid])

  const resumo = {
    disponivel: portas.filter(p => p.status_atual === 'DISPONIVEL').length,
    ocupado: portas.filter(p => p.status_atual !== 'DISPONIVEL').length,
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 
                    hover:shadow-lg transition-shadow duration-200">
      {/* Header do gaveteiro - Compacto */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Building2 size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm">{gaveteiro.nome}</h3>
              <p className="text-[10px] text-blue-200 font-mono">{gaveteiro.codigo_hardware}</p>
            </div>
          </div>
          <button
            onClick={() => carregarPortas()}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-all hover:rotate-180 duration-500"
            title="Atualizar portas"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Indicador de Conexão ESP32 */}
      <div 
        onClick={verificarConexaoEsp32}
        className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
          !gaveteiro.esp32_ip
            ? 'bg-amber-50 text-amber-600 border-amber-200'
            : esp32Online === null 
              ? 'bg-gray-50 text-gray-500' 
              : esp32Online 
                ? 'bg-green-50 text-green-600 border-green-200' 
                : 'bg-red-50 text-red-600 border-red-200'
        } border-b`}
        title={gaveteiro.esp32_ip ? `IP: ${gaveteiro.esp32_ip} - Clique para verificar` : 'IP não configurado'}
      >
        {checkingConnection ? (
          <Loader2 size={12} className="animate-spin" />
        ) : !gaveteiro.esp32_ip ? (
          <AlertCircle size={12} />
        ) : esp32Online === null ? (
          <Wifi size={12} className="opacity-50" />
        ) : esp32Online ? (
          <Wifi size={12} />
        ) : (
          <WifiOff size={12} />
        )}
        <span>
          {checkingConnection 
            ? 'Verificando...' 
            : !gaveteiro.esp32_ip
              ? 'Sem IP'
              : esp32Online === null 
                ? gaveteiro.esp32_ip
                : esp32Online 
                  ? `Online (${gaveteiro.esp32_ip})`
                  : `Offline (${gaveteiro.esp32_ip})`}
        </span>
      </div>

      {/* Resumo - Compacto */}
      <div className="flex text-xs font-medium">
        <div className="flex-1 text-center py-1.5 bg-green-50 text-green-600 flex items-center justify-center gap-1.5 border-b border-r border-gray-100">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          <span>{resumo.disponivel} livres</span>
        </div>
        <div className="flex-1 text-center py-1.5 bg-red-50 text-red-600 flex items-center justify-center gap-1.5 border-b border-gray-100">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
          <span>{resumo.ocupado} ocupados</span>
        </div>
      </div>

      {/* Grid de portas - Compacto */}
      <div className="p-2.5">
        {loading ? (
          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : portas.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-xs">
            <Package size={24} className="mx-auto mb-1 opacity-50" />
            Nenhuma porta
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {portas.map(porta => (
              <PortaMini
                key={porta.uid}
                porta={porta}
                deviceId={gaveteiro.codigo_hardware}
                condominioUid={condominioUid}
                gaveteiroUid={gaveteiro.uid}
                onUpdate={carregarPortas}
                esp32Online={esp32Online}
                checkingConnection={checkingConnection}
                esp32Ip={gaveteiro.esp32_ip}
                esp32Token={gaveteiro.esp32_token}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
