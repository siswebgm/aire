import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Package,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  ArrowLeft,
  ArrowRight,
  Inbox,
  ShoppingCart,
  Delete,
  Building2,
  Home,
  Phone,
  QrCode,
  Camera,
  Sparkles,
  LogOut,
  Sun,
  Moon,
  Check,
  Send
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
  listarGaveteiros,
  listarPortas,
  listarBlocos,
  listarApartamentos,
  ocuparPortaViaApi,
  abrirPortaEsp32,
  fecharPortaEsp32,
  atualizarStatusPorta,
  atualizarStatusFechaduraPorNumero,
  atualizarSensorImaPorNumero,
  type Destinatario
} from '../services/gaveteiroService'
import type { Gaveteiro, Porta, Bloco, Apartamento } from '../types/gaveteiro'

type Etapa =
  | 'modo'
  | 'bloco_apto'
  | 'apto'
  | 'tamanho'
  | 'confirmando'
  | 'sucesso'
  | 'erro'
  | 'erro_fechamento'
  | 'retirar_senha'
  | 'retirar_abrindo'
  | 'retirar_sucesso'
  | 'retirar_erro'
type Modo = 'entregar' | 'retirar' | null

export default function PdvPage() {
  // Dark mode automático: horário do dia ou preferência do sistema
  const [temaEscuro, setTemaEscuro] = useState(false)
  useEffect(() => {
    const detectarTema = () => {
      const hora = new Date().getHours()
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      // Escuro entre 18h e 6h, ou se o sistema preferir escuro
      const deveSerEscuro = (hora >= 18 || hora < 6) || prefersDark
      setTemaEscuro(deveSerEscuro)
    }
    detectarTema()
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', detectarTema)
    // Atualiza a cada minuto para capturar mudança de horário
    const interval = setInterval(detectarTema, 60000)
    return () => {
      mediaQuery.removeEventListener('change', detectarTema)
      clearInterval(interval)
    }
  }, [])

  const { usuario, condominio, logout } = useAuth()

  // Estado geral
  const [etapa, setEtapa] = useState<Etapa>('modo')
  const [animacaoKey, setAnimacaoKey] = useState(0)
  const [modo, setModo] = useState<Modo>(null)
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [mensagemErro, setMensagemErro] = useState('')
  const [modalLogoutAberto, setModalLogoutAberto] = useState(false)

  // Dados carregados
  const [gaveteiros, setGaveteiros] = useState<Gaveteiro[]>([])
  const [todasPortas, setTodasPortas] = useState<Porta[]>([])
  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])

  // Fluxo ENTREGAR
  const [campoAtivo, setCampoAtivo] = useState<'bloco' | 'apto'>('bloco')
  const [blocoDigitado, setBlocoDigitado] = useState('')
  const [aptoDigitado, setAptoDigitado] = useState('')
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState<'P' | 'M' | 'G' | 'GG' | null>(null)
  const [portaSelecionada, setPortaSelecionada] = useState<Porta | null>(null)

  // Fluxo RETIRAR
  const [senhaRetirada, setSenhaRetirada] = useState('')
  const [retiradaProcessando, setRetiradaProcessando] = useState(false)
  const [retiradaMensagem, setRetiradaMensagem] = useState('')
  const [retiradaPortaInfo, setRetiradaPortaInfo] = useState<{
    porta_uid: string
    numero_porta: number
    gaveteiro_uid: string
    bloco?: string | null
    apartamento?: string | null
    senha_uid?: string | null
  } | null>(null)
  const [retiradaUiStyle] = useState<'clean' | 'dynamic'>('dynamic')
  const [modalScannerAberto, setModalScannerAberto] = useState(false)
  const [camerasDisponiveis, setCamerasDisponiveis] = useState<Array<{ deviceId: string; label: string }>>([])
  const [cameraSelecionadaId, setCameraSelecionadaId] = useState<string>('')
  const senhaRetiradaInputRef = useRef<HTMLInputElement | null>(null)
  const scannerAutoOpenedRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerStreamRef = useRef<MediaStream | null>(null)
  const scanRafRef = useRef<number | null>(null)
  const zxingReaderRef = useRef<any>(null)

  // Sucesso
  const [senhasGeradas, setSenhasGeradas] = useState<Array<{ bloco: string; apartamento: string; senha: string }>>([])
  const [progressoFechadura, setProgressoFechadura] = useState(0)
  const [fechaduraConfirmada, setFechaduraConfirmada] = useState(false)
  const jaCarregouRef = useRef(false)
  const timerFechadura = useRef<ReturnType<typeof setInterval> | null>(null)
  const fecharPortaAgoraRef = useRef<() => Promise<void>>(async () => {})
  const [progressoAutoReiniciar, setProgressoAutoReiniciar] = useState(0)
  const timerAutoReiniciar = useRef<ReturnType<typeof setInterval> | null>(null)
  const [modalComprovanteAberto, setModalComprovanteAberto] = useState(false)
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false)
  const [whatsappEntregador, setWhatsappEntregador] = useState('')
  const [fechandoPortaAgora, setFechandoPortaAgora] = useState(false)
  const [erroFechadura, setErroFechadura] = useState('')
  const [comprovanteEnviando, setComprovanteEnviando] = useState(false)
  const [comprovanteErro, setComprovanteErro] = useState('')

  // Carregar dados e configurar realtime
  useEffect(() => {
    if (!condominio?.uid) return

    carregarDados()

    // Subscription realtime para portas — atualiza disponibilidade em tempo real
    const portasChannel = supabase
      .channel('pdv-portas-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'cobrancas',
          table: 'gvt_portas'
        },
        (payload) => {
          console.log('[PDV REAL-TIME] Mudança em gvt_portas:', payload.eventType)

          if (payload.eventType === 'UPDATE') {
            setTodasPortas(prev => prev.map(p =>
              p.uid === payload.new.uid
                ? { ...p, ...payload.new } as Porta
                : p
            ))
          } else if (payload.eventType === 'INSERT') {
            setTodasPortas(prev => [...prev, payload.new as Porta])
          } else if (payload.eventType === 'DELETE') {
            setTodasPortas(prev => prev.filter(p => p.uid !== payload.old.uid))
          }
        }
      )
      .subscribe((status) => {
        console.log('[PDV REAL-TIME] Status:', status)
      })

    return () => {
      console.log('[PDV REAL-TIME] Removendo subscription')
      supabase.removeChannel(portasChannel)
    }
  }, [condominio?.uid])

  const carregarDados = async () => {
    if (!condominio?.uid) return
    if (!jaCarregouRef.current) setLoading(true)
    try {
      const [gaveteirosData, blocosData, apartamentosData] = await Promise.all([
        listarGaveteiros(condominio.uid),
        listarBlocos(condominio.uid),
        listarApartamentos(condominio.uid)
      ])
      setGaveteiros(gaveteirosData)
      setBlocos(blocosData)
      setApartamentos(apartamentosData)

      // Carregar portas de todos os gaveteiros
      const portasPromises = gaveteirosData.map(g => listarPortas(g.uid))
      const portasArrays = await Promise.all(portasPromises)
      setTodasPortas(portasArrays.flat())
    } catch (err) {
      console.error('[PDV] Erro ao carregar dados:', err)
    } finally {
      jaCarregouRef.current = true
      setLoading(false)
    }
  }

  // Portas disponíveis por tamanho
  const portasDisponiveisPorTamanho = useMemo(() => {
    const disponiveis = todasPortas.filter(p => p.status_atual === 'DISPONIVEL' && p.ativo && !(p as any).reservada_portaria)
    return {
      P: disponiveis.filter(p => p.tamanho === 'P'),
      M: disponiveis.filter(p => p.tamanho === 'M'),
      G: disponiveis.filter(p => p.tamanho === 'G'),
      GG: disponiveis.filter(p => p.tamanho === 'GG'),
    }
  }, [todasPortas])

  // Blocos únicos
  const blocosUnicos = useMemo(() => {
    return Array.from(new Set(blocos.map(b => b.nome))).sort((a, b) => {
      const numA = parseInt(a)
      const numB = parseInt(b)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.localeCompare(b)
    })
  }, [blocos])

  // Detectar se blocos são numéricos ou letras
  const blocosEhLetras = useMemo(() => {
    if (blocosUnicos.length === 0) return false
    return blocosUnicos.every(b => /^[A-Za-z]+$/.test(b.trim()))
  }, [blocosUnicos])

  // Normalizar bloco digitado: '02' → encontra '2' no banco, ou vice-versa
  const normalizarBloco = (digitado: string): string | null => {
    if (!digitado) return null
    // Match exato
    if (blocosUnicos.includes(digitado)) return digitado
    // Se digitou número com zero à esquerda (ex: '02'), tenta sem zero
    const semZero = digitado.replace(/^0+/, '')
    if (semZero && blocosUnicos.includes(semZero)) return semZero
    // Se digitou sem zero (ex: '2'), tenta com zero (ex: '02')
    const comZero = digitado.padStart(2, '0')
    if (blocosUnicos.includes(comZero)) return comZero
    return null
  }

  // Bloco normalizado (o nome real do bloco no banco)
  const blocoNormalizado = useMemo(() => normalizarBloco(blocoDigitado), [blocoDigitado, blocosUnicos])

  // Apartamentos do bloco digitado
  const aptosDoBloco = useMemo(() => {
    if (!blocoNormalizado) return []
    return apartamentos
      .filter(a => a.bloco?.nome === blocoNormalizado)
      .map(a => a.numero)
      .sort((a, b) => {
        const numA = parseInt(a)
        const numB = parseInt(b)
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB
        return a.localeCompare(b)
      })
  }, [apartamentos, blocoNormalizado])

  // Validação bloco/apto
  const blocoValido = blocoNormalizado !== null
  const aptoValido = aptosDoBloco.includes(aptoDigitado)

  // Teclado numérico
  const handleNumpad = (num: string) => {
    if (campoAtivo === 'bloco') {
      if (blocoDigitado.length < 4) {
        const novoBloco = blocoDigitado + num
        setBlocoDigitado(novoBloco)
      }
    } else {
      if (aptoDigitado.length < 5) setAptoDigitado(prev => prev + num)
    }
  }

  // Confirmar bloco com Enter ou autoavançar
  const confirmarBloco = () => {
    if (campoAtivo === 'bloco' && blocoDigitado) {
      const blocoNormalizadoTemp = normalizarBloco(blocoDigitado)
      if (blocoNormalizadoTemp) {
        setBlocoDigitado(blocoNormalizadoTemp)
        setCampoAtivo('apto')
      }
    }
  }

  // Auto-avançar para Apto quando bloco se tornar válido
  useEffect(() => {
    if (blocoValido && campoAtivo === 'bloco' && aptoDigitado === '') {
      setCampoAtivo('apto')
    }
  }, [blocoValido])

  const handleNumpadRetirada = (num: string) => {
    if (senhaRetirada.length < 12) setSenhaRetirada(prev => prev + num)
  }

  const handleBackspaceRetirada = () => {
    setSenhaRetirada(prev => prev.slice(0, -1))
  }

  const handleLimparRetirada = () => {
    setSenhaRetirada('')
  }

  const handleBackspace = () => {
    if (campoAtivo === 'bloco') {
      setBlocoDigitado(prev => prev.slice(0, -1))
    } else {
      setAptoDigitado(prev => prev.slice(0, -1))
    }
  }

  const handleLimpar = () => {
    if (campoAtivo === 'bloco') {
      setBlocoDigitado('')
    } else {
      setAptoDigitado('')
    }
  }

  // Avançar do bloco/apto para seleção de tamanho
  const avancarParaTamanho = () => {
    if (!blocoValido || !aptoValido) return
    setEtapa('tamanho')
    setAnimacaoKey(prev => prev + 1)
  }

  // Selecionar tamanho e porta
  const selecionarTamanho = (tamanho: 'P' | 'M' | 'G' | 'GG') => {
    const disponiveis = portasDisponiveisPorTamanho[tamanho]
    if (disponiveis.length === 0) return
    setTamanhoSelecionado(tamanho)
    // Seleciona a primeira porta disponível desse tamanho
    setPortaSelecionada(disponiveis[0])
  }

  // Tentar abrir uma porta específica via ESP32 (pré-teste + abertura real)
  const tentarAbrirPorta = async (porta: Porta): Promise<boolean> => {
    if (!condominio?.uid) return false

    // 1) Pré-teste
    try {
      const testResp = await fetch('/api/proxy/abrir-porta-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condominioUid: condominio.uid,
          portaUid: porta.uid,
          porta: porta.numero_porta,
          testOnly: true
        })
      })
      const testData = await testResp.json().catch(() => null)
      if (!testResp.ok || !testData?.success) return false
    } catch {
      return false
    }

    // 2) Abrir porta física
    try {
      const resp = await fetch('/api/proxy/abrir-porta-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condominioUid: condominio.uid,
          portaUid: porta.uid,
          porta: porta.numero_porta
        })
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !data?.success) return false

      // Sucesso — atualiza sensor de ímã para aberto
      try {
        await atualizarSensorImaPorNumero(
          porta.gaveteiro_uid,
          porta.numero_porta,
          'aberto'
        )
      } catch (err) {
        console.warn('[PDV] Falha ao atualizar sensor_ima para aberto:', err)
      }
      return true
    } catch {
      return false
    }
  }

  // Confirmar ocupação — tenta portas disponíveis do tamanho até abrir
  const confirmarOcupacao = async () => {
    if (!tamanhoSelecionado || !condominio?.uid) return

    const disponiveis = portasDisponiveisPorTamanho[tamanhoSelecionado]
    if (disponiveis.length === 0) {
      setMensagemErro('Nenhuma porta disponível para este tamanho.')
      setEtapa('erro')
      return
    }

    setProcessando(true)
    setEtapa('confirmando')
    setMensagemErro('')

    // Começa da porta atual (se estiver na lista) ou da primeira
    const idxAtual = portaSelecionada
      ? disponiveis.findIndex(p => p.uid === portaSelecionada.uid)
      : -1
    const inicio = idxAtual >= 0 ? idxAtual : 0

    for (let i = inicio; i < disponiveis.length; i++) {
      const porta = disponiveis[i]
      setPortaSelecionada(porta)
      console.log(`[PDV] Tentando porta ${porta.numero_porta} (${i + 1}/${disponiveis.length})`)

      const abriu = await tentarAbrirPorta(porta)
      if (abriu) {
        setEtapa('sucesso')
        setAnimacaoKey(prev => prev + 1)
        setProcessando(false)
        return
      }

      console.warn(`[PDV] Porta ${porta.numero_porta} falhou, tentando próxima...`)
    }

    // Todas as portas do tamanho falharam
    console.error('[PDV] Todas as portas disponíveis falharam.')
    setMensagemErro(
      'Não foi possível abrir nenhuma porta disponível deste tamanho. ' +
      'Verifique se o armário está ligado e conectado, ou escolha outro tamanho.'
    )
    setEtapa('erro')
    setProcessando(false)
  }

  // Timer de progresso na tela de sucesso (simula espera do sensor de fechadura)
  const TEMPO_FECHADURA = 60 // segundos
  useEffect(() => {
    if (etapa !== 'sucesso') {
      // Limpar timer ao sair da etapa
      if (timerFechadura.current) {
        clearInterval(timerFechadura.current)
        timerFechadura.current = null
      }
      return
    }

    // Iniciar contagem de progresso
    setProgressoFechadura(0)
    setFechaduraConfirmada(false)
    const inicio = Date.now()

    timerFechadura.current = setInterval(() => {
      const elapsed = (Date.now() - inicio) / 1000
      const pct = Math.min((elapsed / TEMPO_FECHADURA) * 100, 100)
      setProgressoFechadura(pct)

      if (pct >= 100) {
        if (timerFechadura.current) clearInterval(timerFechadura.current)
        void fecharPortaAgoraRef.current()
      }
    }, 100)

    return () => {
      if (timerFechadura.current) {
        clearInterval(timerFechadura.current)
        timerFechadura.current = null
      }
    }
  }, [etapa])

  // Auto-reiniciar 60s após entrega confirmada (cancelado se comprovante aberto)
  const TEMPO_AUTO_REINICIAR = 60 // segundos
  const modalFechadoManualmente = useRef(false)
  useEffect(() => {
    if (etapa !== 'sucesso' || !fechaduraConfirmada || modalComprovanteAberto) {
      if (timerAutoReiniciar.current) {
        clearInterval(timerAutoReiniciar.current)
        timerAutoReiniciar.current = null
      }
      if (!modalComprovanteAberto) {
        setProgressoAutoReiniciar(0)
        // Se o modal foi fechado manualmente, não reiniciar automaticamente
        if (modalFechadoManualmente.current) {
          modalFechadoManualmente.current = false
        }
      }
      return
    }

    // Não iniciar auto-reiniciar se o modal foi fechado manualmente
    if (modalFechadoManualmente.current) {
      modalFechadoManualmente.current = false
      return
    }

    setProgressoAutoReiniciar(0)
    const inicio = Date.now()

    timerAutoReiniciar.current = setInterval(() => {
      const elapsed = (Date.now() - inicio) / 1000
      const pct = Math.min((elapsed / TEMPO_AUTO_REINICIAR) * 100, 100)
      setProgressoAutoReiniciar(pct)

      if (pct >= 100) {
        if (timerAutoReiniciar.current) {
          clearInterval(timerAutoReiniciar.current)
          timerAutoReiniciar.current = null
        }
        setTimeout(() => { reiniciar() }, 300)
      }
    }, 200)

    return () => {
      if (timerAutoReiniciar.current) {
        clearInterval(timerAutoReiniciar.current)
        timerAutoReiniciar.current = null
      }
    }
  }, [etapa, fechaduraConfirmada, modalComprovanteAberto])

  // Monitorar sensor da porta selecionada via realtime
  useEffect(() => {
    if (etapa !== 'sucesso' || !portaSelecionada || fechaduraConfirmada) return

    const portaAtual = todasPortas.find(p => p.uid === portaSelecionada.uid)
    const sensorStatus = ((portaAtual as any)?.sensor_ima_status || '').toLowerCase()
    const statusPorta = ((portaAtual as any)?.status_atual || '').toUpperCase()

    console.log('[PDV SENSOR] Porta:', portaSelecionada.uid, '| sensor_ima_status:', sensorStatus, '| status_atual:', statusPorta)

    // Detectar fechamento: sensor fechado OU status da porta mudou para OCUPADO
    const sensorFechado = ['fechado', 'closed', '1'].includes(sensorStatus)

    if (sensorFechado) {
      console.log('[PDV SENSOR] Compartimento fechado detectado — executando fecharPortaAgora')
      void fecharPortaAgoraRef.current()
    }
  }, [etapa, todasPortas, portaSelecionada, fechaduraConfirmada])

  // Reiniciar
  function reiniciar() {
    setEtapa('modo')
    setModo(null)
    setBlocoDigitado('')
    setAptoDigitado('')
    setCampoAtivo('bloco')
    setTamanhoSelecionado(null)
    setPortaSelecionada(null)
    setSenhasGeradas([])
    setMensagemErro('')
    setSenhaRetirada('')
    setRetiradaProcessando(false)
    setRetiradaMensagem('')
    setRetiradaPortaInfo(null)
    setModalScannerAberto(false)
    setProgressoFechadura(0)
    setFechaduraConfirmada(false)
    setProgressoAutoReiniciar(0)
    setModalComprovanteAberto(false)
    setWhatsappEntregador('')
    setErroFechadura('')
    if (timerFechadura.current) {
      clearInterval(timerFechadura.current)
      timerFechadura.current = null
    }
    if (timerAutoReiniciar.current) {
      clearInterval(timerAutoReiniciar.current)
      timerAutoReiniciar.current = null
    }
    carregarDados()
  }

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc para voltar ou cancelar
      if (e.key === 'Escape') {
        if (etapa === 'modo') {
          return
        }
        if (etapa === 'bloco_apto' || etapa === 'apto' || etapa === 'tamanho') {
          voltar()
        } else {
          reiniciar()
        }
      }

      // Enter para avançar
      if (e.key === 'Enter') {
        if (etapa === 'bloco_apto' && blocoValido) {
          setEtapa('apto')
          setAnimacaoKey(prev => prev + 1)
        } else if (etapa === 'apto' && aptoValido) {
          avancarParaTamanho()
        } else if (etapa === 'tamanho' && tamanhoSelecionado && portaSelecionada) {
          confirmarOcupacao()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [etapa, blocoValido, aptoValido, tamanhoSelecionado, portaSelecionada])

  const parseSenhaFromQr = (raw: string): { senha: string; condominioUid?: string } => {
    const s = String(raw || '').trim()
    if (!s) return { senha: '' }
    const parts = s.split('_').filter(Boolean)
    if (parts.length >= 2) {
      return { senha: parts[0], condominioUid: parts[1] }
    }
    return { senha: s }
  }

  const validarERetirar = useCallback(async (senhaRaw?: string) => {
    const raw = senhaRaw ?? senhaRetirada
    const { senha, condominioUid } = parseSenhaFromQr(raw)
    if (!senha || senha.length < 4) {
      setRetiradaMensagem('Digite/escaneie a senha completa')
      setEtapa('retirar_erro')
      return
    }
    if (condominioUid && condominio?.uid && condominioUid !== condominio.uid) {
      setRetiradaMensagem('QR Code não pertence a este condomínio')
      setEtapa('retirar_erro')
      return
    }
    if (!condominio?.uid) {
      setRetiradaMensagem('Condomínio não identificado')
      setEtapa('retirar_erro')
      return
    }
    if (retiradaProcessando) return

    setSenhaRetirada('')
    setRetiradaProcessando(true)
    setRetiradaMensagem('Validando senha...')
    setEtapa('retirar_abrindo')

    try {
      const { data: senhaData, error: senhaError } = await supabase
        .from('gvt_senhas_provisorias')
        .select('uid, porta_uid, bloco, apartamento, status')
        .eq('senha', senha)
        .eq('status', 'ATIVA')
        .limit(1)
        .maybeSingle()

      if (senhaError || !senhaData) {
        setRetiradaMensagem('Senha inválida ou já utilizada')
        setEtapa('retirar_erro')
        return
      }

      const { data: portaData, error: portaError } = await supabase
        .from('gvt_portas')
        .select('uid, numero_porta, gaveteiro_uid')
        .eq('uid', senhaData.porta_uid)
        .maybeSingle()

      if (portaError || !portaData) {
        setRetiradaMensagem('Erro ao localizar o compartimento da senha')
        setEtapa('retirar_erro')
        return
      }

      const gaveteiro = gaveteiros.find(g => g.uid === portaData.gaveteiro_uid)
      if (!gaveteiro) {
        setRetiradaMensagem('Gaveteiro não encontrado para esta porta')
        setEtapa('retirar_erro')
        return
      }

      setRetiradaMensagem('Abrindo compartimento...')

      try {
        await abrirPortaEsp32({
          baseUrl: '/esp32',
          token: gaveteiro.esp32_token || 'teste',
          numeroPorta: portaData.numero_porta,
          timeoutMs: 10000
        })
      } catch (err) {
        console.warn('[PDV RETIRADA] Erro ao abrir porta ESP32:', err)
      }

      await supabase
        .from('gvt_senhas_provisorias')
        .update({ status: 'USADA', usada_em: new Date().toISOString(), usada_por: usuario?.uid || null })
        .eq('uid', senhaData.uid)

      await supabase
        .from('gvt_movimentacoes_porta')
        .insert({
          condominio_uid: condominio.uid,
          condominio_nome: (condominio as any)?.nome || null,
          porta_uid: senhaData.porta_uid,
          senha_uid: senhaData.uid,
          acao: 'RETIRADA',
          status_resultante: 'OCUPADO',
          timestamp: new Date().toISOString(),
          origem: 'PDV',
          observacao: `Retirada: ${senhaData.bloco || ''} - Apto ${senhaData.apartamento || ''}`
        })

      const { data: senhasAtivas } = await supabase
        .from('gvt_senhas_provisorias')
        .select('uid')
        .eq('porta_uid', senhaData.porta_uid)
        .eq('status', 'ATIVA')

      if (!senhasAtivas || senhasAtivas.length === 0) {
        await supabase
          .from('gvt_portas')
          .update({
            status_atual: 'DISPONIVEL',
            finalizado_em: new Date().toISOString(),
            bloco_atual: null,
            apartamento_atual: null
          })
          .eq('uid', senhaData.porta_uid)
      }

      setRetiradaPortaInfo({
        porta_uid: portaData.uid,
        numero_porta: portaData.numero_porta,
        gaveteiro_uid: portaData.gaveteiro_uid,
        bloco: senhaData.bloco,
        apartamento: senhaData.apartamento,
        senha_uid: senhaData.uid
      })
      setRetiradaMensagem('Porta aberta! Retire sua encomenda.')
      setEtapa('retirar_sucesso')
      setTimeout(() => reiniciar(), 8000)
    } catch (err) {
      console.error('[PDV RETIRADA] Erro:', err)
      setRetiradaMensagem(err instanceof Error ? err.message : 'Erro ao processar retirada')
      setEtapa('retirar_erro')
    } finally {
      setRetiradaProcessando(false)
    }
  }, [senhaRetirada, condominio?.uid, usuario?.uid, retiradaProcessando, gaveteiros])

  const pararScanner = useCallback(() => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current)
      scanRafRef.current = null
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current?.reset?.()
      } catch {
        // ignore
      }
      zxingReaderRef.current = null
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach(t => t.stop())
      scannerStreamRef.current = null
    }
  }, [])

  const listarCameras = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Câmera ${idx + 1}`
        }))
      setCamerasDisponiveis(cams)
      if (!cameraSelecionadaId && cams.length > 0) {
        setCameraSelecionadaId(cams[0].deviceId)
      }
    } catch {
      // ignore
    }
  }, [cameraSelecionadaId])

  const iniciarScanner = useCallback(async (deviceIdOverride?: string) => {
    if (typeof window === 'undefined') return
    try {
      pararScanner()

      // Aguardar o modal renderizar e o <video> montar
      const startedAt = Date.now()
      while (!videoRef.current && Date.now() - startedAt < 1500) {
        await new Promise(r => setTimeout(r, 50))
      }

      if (!videoRef.current) {
        setModalScannerAberto(false)
        setRetiradaMensagem('Não foi possível inicializar a câmera (vídeo não montou).')
        setEtapa('retirar_erro')
        return
      }

      const deviceId = deviceIdOverride || cameraSelecionadaId
      const videoConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { ideal: deviceId } }
        : { facingMode: 'environment' }

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
      scannerStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => null)
      }

      await listarCameras()

      const hasBarcodeDetector = typeof (window as any).BarcodeDetector !== 'undefined'
      if (hasBarcodeDetector) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })

        const loop = async () => {
          if (!videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            const raw = codes?.[0]?.rawValue
            if (raw) {
              setModalScannerAberto(false)
              setSenhaRetirada(String(raw))
              await validarERetirar(String(raw))
              return
            }
          } catch (e) {
            // ignore
          }
          scanRafRef.current = requestAnimationFrame(loop)
        }

        scanRafRef.current = requestAnimationFrame(loop)
      } else {
        let mod: any
        try {
          mod = await import('@zxing/browser')
        } catch (e) {
          setModalScannerAberto(false)
          setRetiradaMensagem('Leitor de QRCode não instalado. Execute: npm install')
          setEtapa('retirar_erro')
          return
        }

        const Reader = (mod as any).BrowserQRCodeReader
        if (!Reader) {
          setModalScannerAberto(false)
          setRetiradaMensagem('Leitor de QRCode indisponível neste dispositivo')
          setEtapa('retirar_erro')
          return
        }

        const reader = new Reader()
        zxingReaderRef.current = reader

        const videoEl = videoRef.current
        if (!videoEl) {
          setModalScannerAberto(false)
          setRetiradaMensagem('Vídeo não inicializado')
          setEtapa('retirar_erro')
          return
        }

        try {
          const result = await reader.decodeOnceFromVideoElement(videoEl)
          const raw = result?.getText?.() || (result as any)?.text || ''
          if (raw) {
            setModalScannerAberto(false)
            setSenhaRetirada(String(raw))
            await validarERetirar(String(raw))
          }
        } catch (e) {
          setModalScannerAberto(false)
          setRetiradaMensagem('Não foi possível ler o QRCode pela câmera. Tente novamente.')
          setEtapa('retirar_erro')
          return
        }
      }
    } catch (err) {
      console.error('[PDV RETIRADA] Erro ao iniciar scanner:', err)
      setModalScannerAberto(false)
      const e = err as any
      const name = String(e?.name || '')
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setRetiradaMensagem('Permissão de câmera negada. Libere a câmera no navegador e tente novamente.')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setRetiradaMensagem('Câmera não encontrada ou indisponível neste dispositivo.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setRetiradaMensagem('A câmera está em uso por outro aplicativo/aba. Feche e tente novamente.')
      } else {
        // Verificar se está acessando via IP (não localhost)
        const hostname = window.location.hostname
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && window.location.protocol === 'http:') {
          setRetiradaMensagem('A câmera requer HTTPS. Acesse via localhost ou configure HTTPS.')
        } else {
          const msg = err instanceof Error ? err.message : 'Não foi possível acessar a câmera para ler o QRCode'
          setRetiradaMensagem(msg || 'Não foi possível acessar a câmera para ler o QRCode')
        }
      }
      setEtapa('retirar_erro')
    }
  }, [validarERetirar, pararScanner, cameraSelecionadaId, listarCameras])

  useEffect(() => {
    if (modo === 'retirar' && etapa === 'retirar_senha') {
      setTimeout(() => {
        senhaRetiradaInputRef.current?.focus()
      }, 120)
      return
    }
    scannerAutoOpenedRef.current = false
  }, [modo, etapa])

  useEffect(() => {
    if (!modalScannerAberto) {
      pararScanner()
    } else {
      listarCameras()
      // Iniciar scanner automaticamente quando modal abre
      setTimeout(() => {
        iniciarScanner(cameraSelecionadaId)
      }, 100)
    }
    return () => {
      pararScanner()
    }
  }, [modalScannerAberto, pararScanner, listarCameras, cameraSelecionadaId])

  const formatarWhatsapp = useCallback((digits: string) => {
    const d = (digits || '').replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }, [])

  const comprovanteDigit = (digit: string) => {
    setWhatsappEntregador(prev => (prev + digit).replace(/\D/g, '').slice(0, 11))
  }

  const comprovanteBackspace = () => {
    setWhatsappEntregador(prev => prev.slice(0, -1))
  }

  const comprovanteClear = () => {
    setWhatsappEntregador('')
  }

  const fecharPortaAgora = useCallback(async () => {
    if (!portaSelecionada || fechandoPortaAgora) return

    setFechandoPortaAgora(true)
    setErroFechadura('')
    try {
      // 1) Tentar fechar via ESP32 (opcional — não bloqueia se não configurado)
      const gaveteiro = gaveteiros.find(g => g.uid === portaSelecionada.gaveteiro_uid)
      if (gaveteiro?.esp32_ip) {
        try {
          const resp = await fecharPortaEsp32({
            baseUrl: '/esp32',
            token: gaveteiro.esp32_token || 'teste',
            numeroPorta: portaSelecionada.numero_porta,
            timeoutMs: 10000
          })
          if (resp?.ok) {
            await atualizarStatusFechaduraPorNumero(
              portaSelecionada.gaveteiro_uid,
              portaSelecionada.numero_porta,
              'fechada'
            ).catch(e => console.warn('[PDV] Falha ao atualizar fechadura:', e))
            await atualizarSensorImaPorNumero(
              portaSelecionada.gaveteiro_uid,
              portaSelecionada.numero_porta,
              'fechado'
            ).catch(e => console.warn('[PDV] Falha ao atualizar sensor_ima:', e))
          }
        } catch (err) {
          console.warn('[PDV] ESP32 indisponível ao fechar porta (ignorado):', err)
        }
      } else {
        console.warn('[PDV] esp32_ip não configurado — confirmando fechamento manual do usuário')
      }

      // 2) Ocupar porta no banco e gerar senhas
      try {
        const destinatarios: Destinatario[] = [{
          bloco: blocoNormalizado || blocoDigitado,
          apartamento: aptoDigitado,
          quantidade: 1
        }]
        const resultado = await ocuparPortaViaApi({
          portaUid: portaSelecionada.uid,
          condominioUid: condominio!.uid,
          destinatarios,
          usuarioUid: usuario?.uid,
          observacao: `Ocupação via PDV - Armário ${tamanhoSelecionado}`
        })
        if (resultado.senhas) {
          setSenhasGeradas(resultado.senhas)
        }
      } catch (err) {
        console.warn('[PDV] Falha ao registrar ocupação no banco:', err)
      }

      // 3) Confirmar fechamento — usuário clicou no botão = confirmação manual
      setFechaduraConfirmada(true)
      setProgressoFechadura(100)
      if (timerFechadura.current) {
        clearInterval(timerFechadura.current)
        timerFechadura.current = null
      }
    } finally {
      setFechandoPortaAgora(false)
    }
  }, [portaSelecionada, gaveteiros, fechandoPortaAgora, blocoNormalizado, blocoDigitado, aptoDigitado, condominio, usuario, tamanhoSelecionado])
  fecharPortaAgoraRef.current = fecharPortaAgora

  const enviarComprovante = async () => {
    const digits = whatsappEntregador.replace(/\D/g, '')
    if (digits.length < 10) return

    setComprovanteEnviando(true)
    setComprovanteErro('')

    try {
      const payload = {
        tipo: 'comprovante_entregador',
        condominio_uid: condominio?.uid || null,
        condominio_nome: (condominio as any)?.nome || null,
        usuario_uid: usuario?.uid || null,
        porta_uid: portaSelecionada?.uid || null,
        gaveteiro_uid: portaSelecionada?.gaveteiro_uid || null,
        compartimento: portaSelecionada?.numero_porta || null,
        tamanho: tamanhoSelecionado || null,
        bloco: blocoNormalizado || blocoDigitado,
        apartamento: aptoDigitado,
        whatsapp_entregador: digits,
        senhas: (senhasGeradas || []).map(s => ({ ...s })),
        created_at: new Date().toISOString()
      }

      const resp = await fetch('https://whkn8n.guardia.work/webhook/aire-notificar-entregador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(text || `HTTP ${resp.status}`)
      }

      setModalComprovanteAberto(false)
      modalFechadoManualmente.current = true
      reiniciar()
    } catch (e) {
      console.error('[PDV] Erro ao enviar comprovante:', e)
      setComprovanteErro(e instanceof Error ? e.message : 'Erro ao enviar comprovante')
    } finally {
      setComprovanteEnviando(false)
    }
  }

  // Voltar
  const voltar = () => {
    if (etapa === 'tamanho') {
      setEtapa('apto')
      setAnimacaoKey(prev => prev + 1)
      setTamanhoSelecionado(null)
      setPortaSelecionada(null)
    } else if (etapa === 'apto') {
      setEtapa('bloco_apto')
      setAnimacaoKey(prev => prev + 1)
      setAptoDigitado('')
    } else if (etapa === 'bloco_apto') {
      setEtapa('modo')
      setAnimacaoKey(prev => prev + 1)
      setModo(null)
      setBlocoDigitado('')
      setAptoDigitado('')
      setCampoAtivo('bloco')
    }
  }

  const tamanhoLabel: Record<string, string> = { P: 'Pequeno', M: 'Médio', G: 'Grande', GG: 'Extra Grande' }
  const tamanhoDesc: Record<string, string> = { P: 'Envelopes e pacotes pequenos', M: 'Caixas médias', G: 'Pacotes grandes', GG: 'Volumes extra grandes' }

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-gray-100 via-blue-200/70 to-blue-100/50 flex items-center justify-center p-4 relative`}>
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-blue-500/20 to-transparent rounded-t-[100%] transform translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 right-0 h-80 bg-gradient-to-t from-sky-400/15 to-transparent rounded-t-[80%] transform translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-cyan-300/10 to-transparent rounded-t-[60%] transform translate-y-1/4"></div>
          <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-blue-300/10 to-cyan-300/10 rounded-full blur-2xl"></div>
          <div className="absolute top-40 right-32 w-48 h-48 bg-gradient-to-br from-sky-200/8 to-blue-200/8 rounded-full blur-3xl"></div>
          <div className="absolute bottom-40 left-40 w-40 h-40 bg-gradient-to-br from-cyan-200/8 to-sky-300/8 rounded-full blur-2xl"></div>
        </div>
        <div className="text-center relative z-10">
          <Loader2 className={`w-8 h-8 mx-auto animate-spin text-gray-600`} />
          <div className={`mt-4 font-semibold text-gray-600`}>Carregando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen ${temaEscuro ? 'bg-[#0f172a]' : 'bg-[#F4F7FC]'} flex flex-col items-center overflow-hidden relative transition-colors duration-700`}>
      {/* Header discreto: Logo + Sair + Toggle tema */}
      <div className="absolute top-2 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        <img
          src={temaEscuro ? '/logo-airebox_noite.png' : '/logo-airebox.png?v=2'}
          alt="AireBox"
          className="w-16 h-16 sm:w-20 sm:h-20 h-auto pointer-events-auto"
          draggable={false}
        />
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setTemaEscuro(v => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border shadow-sm ${
              temaEscuro
                ? 'bg-white/10 border-white/20 text-yellow-300 hover:bg-white/20'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title={temaEscuro ? 'Modo claro' : 'Modo escuro'}
            aria-label={temaEscuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {temaEscuro ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setModalLogoutAberto(true)}
            className={`h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border shadow-sm ${
              temaEscuro
                ? 'bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title="Sair do sistema"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {/* Rodapé com instrução - só aparece na etapa sucesso antes de confirmar */}
      {etapa === 'sucesso' && !fechaduraConfirmada && (
        <div className="absolute bottom-0 left-0 right-0 z-40 py-4 px-4 text-center">
          <p className={`text-lg font-medium ${temaEscuro ? 'text-gray-400' : 'text-gray-500'}`}>
            Coloque a encomenda e feche a porta
          </p>
        </div>
      )}

      {/* Modal de confirmação de logout */}
      {modalLogoutAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalLogoutAberto(false)}></div>
          <div className={`relative w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl ${temaEscuro ? 'bg-[#1e293b] border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${temaEscuro ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-500'}`}>
              <LogOut size={28} />
            </div>
            <h3 className={`text-xl font-black mb-2 ${temaEscuro ? 'text-white' : 'text-[#1a1a2e]'}`}>Sair do sistema?</h3>
            <p className={`text-sm font-medium mb-8 ${temaEscuro ? 'text-gray-400' : 'text-gray-500'}`}>Você será desconectado e redirecionado para a tela de login.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setModalLogoutAberto(false)}
                className={`flex-1 h-12 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  logout()
                  window.location.href = '/login'
                }}
                className="flex-1 h-12 rounded-2xl font-bold text-sm bg-rose-500 text-white shadow-lg hover:bg-rose-600 transition-all active:scale-95"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ondas suaves no rodapé */}
      <div className="absolute bottom-0 left-0 right-0 h-[45vh] overflow-hidden pointer-events-none">
        <div className={`absolute bottom-[-10%] left-[-10%] right-[-10%] h-full rounded-[50%] opacity-70 ${temaEscuro ? 'bg-[#1e293b]' : 'bg-blue-100'}`}></div>
        <div className={`absolute bottom-[-15%] left-[-5%] right-[-5%] h-[90%] rounded-[45%] opacity-50 ${temaEscuro ? 'bg-[#1e293b]' : 'bg-blue-200'}`}></div>
        <div className={`absolute bottom-[-20%] left-[0%] right-[0%] h-[80%] rounded-[40%] opacity-30 ${temaEscuro ? 'bg-[#1e293b]' : 'bg-blue-300'}`}></div>
      </div>
      {/* Glows decorativos sutis */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-24 left-24 w-40 h-40 bg-blue-300/[0.06] rounded-full blur-3xl"></div>
        <div className="absolute top-32 right-40 w-56 h-56 bg-sky-300/[0.04] rounded-full blur-3xl"></div>
      </div>
      
      {/* Conteúdo */}
      <div className="flex-1 flex items-center justify-center w-full px-4 py-0 relative z-10 overflow-hidden">
      <div className={`w-full ${etapa === 'modo' ? '' : etapa === 'bloco_apto' || etapa === 'apto' || etapa === 'tamanho' || etapa === 'sucesso' || etapa === 'retirar_senha' || etapa === 'retirar_abrindo' || etapa === 'retirar_sucesso' || etapa === 'retirar_erro' ? 'max-w-2xl' : 'max-w-lg'} transition-all`}>

        
        
        {/* ========== ETAPA: MODO (ENTREGAR / RETIRAR) ========== */}
        {etapa === 'modo' && (
          <div className="w-full flex flex-col items-center justify-center px-4 sm:px-6">

            {/* ── Header ── */}
            <div className="flex flex-col items-center gap-2 sm:gap-3 mb-8 sm:mb-10">
              <h1 className={`text-xl sm:text-2xl md:text-[2.2rem] font-black tracking-tight leading-tight text-center ${temaEscuro ? 'text-white' : 'text-[#1a1a2e]'}`}>
                Como podemos <span className="text-[#1976FF]">ajudar?</span>
              </h1>
            </div>

            {/* Cards */}
            <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 sm:gap-6 md:gap-8 w-full max-w-2xl">
              {/* Card Entregar */}
              <button
                type="button"
                onClick={() => {
                  setModo('entregar')
                  setEtapa('bloco_apto')
                  setAnimacaoKey(prev => prev + 1)
                }}
                className="group relative w-full md:w-1/2 min-h-[110px] sm:min-h-[130px] md:min-h-[160px] lg:min-h-[180px] rounded-2xl sm:rounded-[28px] bg-white shadow-[0_2px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_rgba(25,118,255,0.15)] active:shadow-[0_4px_20px_rgba(25,118,255,0.12)] transition-all duration-300 active:-translate-y-1 flex items-center px-3 sm:px-5 md:px-8 lg:px-10 select-none overflow-hidden"
              >
                {/* Ícone */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-[#1976FF] to-[#1255cc] flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                  <Inbox className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" strokeWidth={2} />
                </div>

                {/* Texto */}
                <div className="flex-1 flex flex-col justify-center ml-2 sm:ml-3 md:ml-6 lg:ml-7 text-left min-w-0 overflow-hidden">
                  <div className="text-[1.1rem] sm:text-[1.3rem] md:text-[1.6rem] lg:text-[1.85rem] font-black text-[#1a1a2e] leading-tight">Entregar</div>
                  <div className="text-[10px] sm:text-xs md:text-base text-gray-400 font-medium mt-0.5 sm:mt-1">Deixar no armário</div>
                </div>

                {/* Seta */}
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-gray-50 group-hover:bg-[#1976FF]/10 transition-colors duration-300 flex-shrink-0 ml-1 sm:ml-2">
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-5 md:h-5 text-[#1976FF] group-hover:translate-x-[2px] sm:group-hover:translate-x-[5px] transition-transform duration-300" />
                </div>
              </button>

              {/* Card Retirar */}
              <button
                type="button"
                onClick={() => {
                  setModo('retirar')
                  setEtapa('retirar_senha')
                  setRetiradaMensagem('')
                  setRetiradaPortaInfo(null)
                  setSenhaRetirada('')
                }}
                className="group relative w-full md:w-1/2 min-h-[110px] sm:min-h-[130px] md:min-h-[160px] lg:min-h-[180px] rounded-2xl sm:rounded-[28px] bg-white shadow-[0_2px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_rgba(32,211,194,0.15)] active:shadow-[0_4px_20px_rgba(32,211,194,0.12)] transition-all duration-300 active:-translate-y-1 flex items-center px-3 sm:px-5 md:px-8 lg:px-10 select-none overflow-hidden"
              >
                {/* Ícone */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-[#20D3C2] to-[#17a89a] flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-white" strokeWidth={2} />
                </div>

                {/* Texto */}
                <div className="flex-1 flex flex-col justify-center ml-2 sm:ml-3 md:ml-6 lg:ml-7 text-left min-w-0 overflow-hidden">
                  <div className="text-[1.1rem] sm:text-[1.3rem] md:text-[1.6rem] lg:text-[1.85rem] font-black text-[#1a1a2e] leading-tight">Retirar</div>
                  <div className="text-[10px] sm:text-xs md:text-base text-gray-400 font-medium mt-0.5 sm:mt-1">Retirar do armário</div>
                </div>

                {/* Seta */}
                <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-gray-50 group-hover:bg-[#20D3C2]/10 transition-colors duration-300 flex-shrink-0 ml-1 sm:ml-2">
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-5 md:h-5 text-[#20D3C2] group-hover:translate-x-[2px] sm:group-hover:translate-x-[5px] transition-transform duration-300" />
                </div>
              </button>
            </div>
          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_senha' && (
          <div className="flex flex-col lg:flex-row gap-12">

            {/* Left side: Title */}
            <div className="flex-1 flex items-center justify-center lg:justify-start min-h-[140px]">
              <div className="text-center lg:text-left">
                <h2 className={`text-[1.4rem] sm:text-[1.7rem] lg:text-[2rem] font-bold whitespace-normal leading-snug ${temaEscuro ? 'text-white' : 'text-[#1a1a2e]'}`}>Digite a Senha <br className="hidden lg:block" /> de retirada</h2>
                <p className={`text-[1.4rem] sm:text-[1.7rem] lg:text-[2rem] font-bold whitespace-normal leading-snug ${temaEscuro ? 'text-white' : 'text-[#1a1a2e]'}`}>ou escaneie <br className="hidden lg:block" /> o QR Code</p>
                <button
                  onClick={() => setModalScannerAberto(true)}
                  disabled={retiradaProcessando}
                  className={`mt-4 px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm'} disabled:opacity-50`}
                >
                  <QrCode className="w-5 h-5" />
                  Escanear QR Code
                </button>
              </div>
            </div>

            {/* Right side: Number panel */}
            <div className="flex-1 space-y-5">

            {/* Display da senha */}
            <div className={`rounded-2xl border p-4 sm:p-5 text-center transition-all shadow-md ${
              senhaRetirada ? 'border-blue-400 bg-blue-50 shadow-blue-500/20' : 'border-gray-200 bg-gray-50 shadow-gray-300/30'
            }`}>
              <div className={`text-4xl sm:text-5xl font-bold min-h-[50px] leading-none ${
                senhaRetirada ? 'text-gray-900' : 'text-gray-300'
              }`}>
                {senhaRetirada || '——'}
              </div>
              {retiradaMensagem && (
                <div className="mt-2 text-sm font-semibold text-rose-500">{retiradaMensagem}</div>
              )}
            </div>

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9'].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleNumpadRetirada(n)}
                  disabled={retiradaProcessando}
                  className="h-14 rounded-xl bg-white border border-gray-200 text-xl font-bold text-gray-800 shadow-sm hover:shadow-md hover:border-gray-300 active:scale-95 active:bg-gray-50 transition-all duration-150 select-none disabled:opacity-50"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNumpadRetirada('0')}
                disabled={retiradaProcessando}
                className="h-14 rounded-xl bg-white border border-gray-200 text-xl font-bold text-gray-800 shadow-sm hover:shadow-md hover:border-gray-300 active:scale-95 active:bg-gray-50 transition-all duration-150 select-none disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setModalScannerAberto(true)}
                disabled={retiradaProcessando}
                className="h-14 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-semibold shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all duration-150 select-none disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />QR
              </button>
              <button
                type="button"
                onClick={handleBackspaceRetirada}
                disabled={retiradaProcessando}
                className="h-14 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md hover:border-gray-300 active:scale-95 active:bg-gray-50 transition-all duration-150 select-none disabled:opacity-50"
              >
                <Delete className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={reiniciar}
                className="h-12 px-5 rounded-xl bg-white border border-gray-200 font-semibold text-sm text-gray-600 shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all duration-150 select-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!senhaRetirada) {
                    setRetiradaMensagem('Digite a senha para continuar')
                    setTimeout(() => setRetiradaMensagem(''), 2000)
                  } else {
                    validarERetirar()
                  }
                }}
                disabled={retiradaProcessando}
                className={`flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-150 text-base select-none ${
                  senhaRetirada && !retiradaProcessando
                    ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 active:scale-95'
                    : 'bg-white border border-gray-200 text-gray-400 shadow-sm cursor-not-allowed'
                }`}
              >
                {retiradaProcessando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                  : <>Continuar <ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </div>
            </div>
          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_abrindo' && (
          <div className="max-w-3xl mx-auto px-4 py-16">
            <div className={`rounded-3xl border p-8 text-center ${
              temaEscuro 
                ? 'border-white/10 bg-white/5'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <Loader2 className={`w-10 h-10 animate-spin mx-auto ${
                temaEscuro ? 'text-white/80' : 'text-gray-600'
              }`} />
              <div className={`mt-4 text-2xl font-extrabold ${
                temaEscuro ? 'text-white' : 'text-gray-900'
              }`}>Processando retirada</div>
              <div className={`mt-2 ${
                temaEscuro ? 'text-white/70' : 'text-gray-600'
              }`}>{retiradaMensagem || 'Aguarde...'}</div>
            </div>
          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_sucesso' && (
          <div className="flex flex-col items-center text-center gap-8 py-8 px-2">

            {/* Badge da porta */}
            {retiradaPortaInfo && (
              <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
                <div className="absolute inset-0 rounded-full bg-blue-400/15 animate-ping" style={{ animationDuration: '2.2s' }} />
                <div className="absolute w-32 h-32 rounded-full bg-blue-400/20 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.6s' }} />
                <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-2xl shadow-blue-400/50">
                  <span className="text-6xl font-black text-white leading-none">
                    {retiradaPortaInfo.numero_porta}
                  </span>
                </div>
              </div>
            )}

            {/* Título + instrução */}
            <div className="space-y-3">
              <div className="text-4xl font-black text-gray-900 leading-tight">
                Compartimento{retiradaPortaInfo ? <> <span className="text-blue-500">{retiradaPortaInfo.numero_porta}</span></> : ''} aberto!
              </div>
              <div className="text-lg text-gray-400 font-medium">
                Retire a encomenda e feche a porta
              </div>
              {retiradaPortaInfo?.bloco && (
                <span className="inline-block bg-white/70 backdrop-blur rounded-full px-5 py-2 text-sm font-bold text-blue-700 tracking-widest uppercase shadow-sm">
                  Bloco {retiradaPortaInfo.bloco} &nbsp;·&nbsp; Apto {retiradaPortaInfo.apartamento}
                </span>
              )}
            </div>

            {/* Botão */}
            <div className="w-full pt-2">
              <button
                type="button"
                onClick={() => reiniciar()}
                className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Package className="w-5 h-5" />
                Nova operação
              </button>
            </div>

          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_erro' && (
          <div className="flex flex-col items-center text-center gap-6 py-8 px-2">

            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-xl shadow-rose-400/30">
              <XCircle className="w-10 h-10 text-white" />
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-black text-gray-900">Não foi possível liberar</div>
              <div className="text-base text-gray-500">{retiradaMensagem || 'Verifique a senha e tente novamente.'}</div>
            </div>

            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEtapa('retirar_senha')
                  setRetiradaMensagem('')
                }}
                className="w-full h-16 rounded-2xl bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => reiniciar()}
                className="w-full h-12 rounded-2xl bg-white border border-gray-200 text-gray-600 font-semibold text-base hover:bg-gray-50 active:scale-95 transition-all"
              >
                Cancelar
              </button>
            </div>

          </div>
        )}

        {modalScannerAberto && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setModalScannerAberto(false)
                pararScanner()
              }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <div className="relative w-full sm:max-w-lg bg-white border border-gray-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">

              {/* Header do modal */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-500" />
                  <span className="font-extrabold text-gray-900">Escanear QR Code</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalScannerAberto(false)
                    pararScanner()
                  }}
                  className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Seletor de câmera */}
              {camerasDisponiveis.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Câmera</div>
                  <select
                    value={cameraSelecionadaId}
                    onChange={(e) => {
                      const id = e.target.value
                      setCameraSelecionadaId(id)
                      pararScanner()
                      setTimeout(() => { iniciarScanner(id) }, 50)
                    }}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 text-sm"
                  >
                    {camerasDisponiveis.map(c => (
                      <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Viewfinder da câmera */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200 bg-gray-900">
                <video ref={videoRef} className="w-full h-64 sm:h-72 object-cover" muted playsInline />
                {/* Blur nas bordas */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/40" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
                </div>
                {/* Guia de scan */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-44 h-44 border-2 border-white/60 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    {/* Linha de scan animada */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                </div>
                {/* Indicador de scanning */}
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
                  <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-white text-xs font-semibold">Pronto para escanear</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm text-gray-500 text-center">Aponte a câmera para o QR Code do comprovante</p>
            </div>
          </div>
        )}

        {etapa === 'bloco_apto' && (
          <div key={animacaoKey} className="flex flex-col lg:flex-row gap-12 animate-slide-in-right">
            {/* Left side: Title */}
            <div className="flex-1 flex items-center justify-center lg:justify-start min-h-[140px]">
              <h2 className={`text-[1.6rem] sm:text-[1.9rem] lg:text-[2.3rem] font-bold text-center lg:text-left whitespace-normal leading-snug ${temaEscuro ? 'text-white' : 'text-[#1a1a2e]'}`}>Qual bloco <br className="hidden lg:block" /> deseja depositar <br className="hidden lg:block" /> a encomenda?</h2>
            </div>
            {/* Right side: Number panel */}
            <div className="flex-1 space-y-5">
              <div className={`rounded-2xl border p-4 sm:p-5 text-center transition-all ${blocoValido ? (temaEscuro ? 'border-emerald-400 bg-emerald-500/10' : 'border-emerald-500 bg-emerald-50') : blocoDigitado.length >= 2 && !blocoValido ? (temaEscuro ? 'border-rose-400 bg-rose-500/10' : 'border-rose-500 bg-rose-50') : temaEscuro ? 'border-[#1976FF] bg-white/5' : 'border-[#1976FF] bg-white shadow-sm'} ${blocoValido ? (temaEscuro ? 'shadow-md shadow-emerald-400/20' : 'shadow-md shadow-emerald-500/20') : blocoDigitado.length >= 2 && !blocoValido ? (temaEscuro ? 'shadow-md shadow-rose-400/20' : 'shadow-md shadow-rose-500/20') : ''}`}>
                <div className="relative">
                  <div className={`text-4xl sm:text-5xl font-black min-h-[50px] leading-none ${blocoDigitado ? (temaEscuro ? 'text-white' : 'text-gray-900') : 'text-gray-400'}`}>{blocoDigitado || '—'}</div>
                  {blocoValido && (
                    <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg ${temaEscuro ? 'bg-emerald-400' : 'bg-emerald-500'}`}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {blocoDigitado.length >= 2 && !blocoValido && (
                    <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg ${temaEscuro ? 'bg-rose-400' : 'bg-rose-500'}`}>
                      <X className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                {blocoDigitado.length >= 2 && !blocoValido && <div className="text-sm font-semibold text-rose-500 mt-2">Bloco não encontrado</div>}
              </div>
              {blocosEhLetras && <div className="flex flex-wrap gap-3 justify-center">{blocosUnicos.map(b => <button key={b} onClick={() => { setBlocoDigitado(b); setEtapa('apto') }} className={`h-14 px-5 sm:px-6 rounded-2xl font-extrabold text-xl transition-all active:scale-95 ${blocoDigitado === b ? 'bg-[#1976FF] text-white shadow-lg' : temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-800 border-2 border-gray-300 shadow-md hover:border-[#1976FF]'}`}>{b}</button>)}</div>}
              {!blocosEhLetras && <div className="grid grid-cols-3 gap-3">{['1','2','3','4','5','6','7','8','9'].map(n => <button key={n} onClick={() => { const next = blocoDigitado + n; setBlocoDigitado(next) }} className={`h-14 rounded-xl text-xl font-bold shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-800 border border-gray-300 shadow-md hover:border-[#1976FF]'}`}>{n}</button>)}<button onClick={voltar} className="h-14 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 active:scale-95 transition-all shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Voltar</button><button onClick={() => { const next = blocoDigitado + '0'; setBlocoDigitado(next) }} className={`h-14 rounded-xl text-xl font-bold shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-800 border border-gray-300 shadow-md hover:border-[#1976FF]'}`}>0</button><button onClick={() => setBlocoDigitado(p => p.slice(0, -1))} className={`h-14 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 border border-white/20 hover:bg-white/20' : 'bg-white border border-gray-300 shadow-md hover:border-[#1976FF]'}`}><Delete className={`w-5 h-5 ${temaEscuro ? 'text-white' : 'text-gray-500'}`} /></button></div>}
              <div className="flex gap-3">
                <button onClick={reiniciar} className={`h-12 px-5 rounded-xl font-semibold text-sm shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>Cancelar</button>
                <button onClick={() => { if (blocoValido) { setEtapa('apto'); setAnimacaoKey(prev => prev + 1); } }} disabled={!blocoValido} className={`flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2 text-base active:scale-95 transition-all disabled:cursor-not-allowed ${blocoValido ? 'bg-[#1976FF] text-white shadow-md hover:bg-blue-700' : temaEscuro ? 'bg-white/10 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>Próximo <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        {/* ========== ETAPA: APARTAMENTO ========== */}
        {etapa === 'apto' && (
          <div key={animacaoKey} className="flex flex-col lg:flex-row gap-12 animate-slide-in-right">
            {/* Left side: Title */}
            <div className="flex-1 flex items-center justify-center lg:justify-start min-h-[140px]">
              <div>
                <div className={`text-sm font-bold tracking-widest uppercase mb-0.5 ${temaEscuro ? 'text-blue-400' : 'text-blue-600'}`}>
                  Bloco {blocoNormalizado || blocoDigitado}
                </div>
                <h2 className={`text-[1.6rem] sm:text-[1.9rem] lg:text-[2.3rem] font-bold text-center lg:text-left whitespace-normal leading-snug ${temaEscuro ? 'text-white' : 'text-[#1a1a2e]'}`}>Qual apartamento <br className="hidden lg:block" /> deseja depositar <br className="hidden lg:block" /> a encomenda?</h2>
              </div>
            </div>
            {/* Right side: Number panel */}
            <div className="flex-1 space-y-5">
            <div className={`rounded-2xl border p-4 sm:p-5 text-center transition-all ${aptoValido ? (temaEscuro ? 'border-emerald-400 bg-emerald-500/10' : 'border-emerald-500 bg-emerald-50') : aptoDigitado.length >= 3 && !aptoValido ? (temaEscuro ? 'border-rose-400 bg-rose-500/10' : 'border-rose-500 bg-rose-50') : temaEscuro ? 'border-[#20D3C2] bg-white/5' : 'border-[#20D3C2] bg-white shadow-sm'} ${aptoValido ? (temaEscuro ? 'shadow-md shadow-emerald-400/20' : 'shadow-md shadow-emerald-500/20') : aptoDigitado.length >= 3 && !aptoValido ? (temaEscuro ? 'shadow-md shadow-rose-400/20' : 'shadow-md shadow-rose-500/20') : ''}`}>
              <div className="relative">
                <div className={`text-4xl sm:text-5xl font-black min-h-[50px] leading-none ${aptoDigitado ? (temaEscuro ? 'text-white' : 'text-gray-900') : 'text-gray-400'}`}>{aptoDigitado || '—'}</div>
                {aptoValido && (
                  <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg ${temaEscuro ? 'bg-emerald-400' : 'bg-emerald-500'}`}>
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                {aptoDigitado.length >= 3 && !aptoValido && (
                  <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg ${temaEscuro ? 'bg-rose-400' : 'bg-rose-500'}`}>
                    <X className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              {aptoDigitado.length >= 3 && !aptoValido && <div className="text-sm font-semibold text-rose-500 mt-2">Apartamento não encontrado</div>}
            </div>
            <div className="grid grid-cols-3 gap-3">{['1','2','3','4','5','6','7','8','9'].map(n => <button key={n} onClick={() => setAptoDigitado(p => p + n)} className={`h-14 rounded-xl text-xl font-bold shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-800 border border-gray-300 shadow-md hover:border-[#20D3C2]'}`}>{n}</button>)}<button onClick={voltar} className="h-14 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 active:scale-95 transition-all shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Voltar</button><button onClick={() => setAptoDigitado(p => p + '0')} className={`h-14 rounded-xl text-xl font-bold shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-800 border border-gray-300 shadow-md hover:border-[#20D3C2]'}`}>0</button><button onClick={() => setAptoDigitado(p => p.slice(0, -1))} className={`h-14 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 border border-white/20 hover:bg-white/20' : 'bg-white border border-gray-300 shadow-md hover:border-[#20D3C2]'}`}><Delete className={`w-5 h-5 ${temaEscuro ? 'text-white' : 'text-gray-500'}`} /></button></div>
            <div className="flex gap-3">
              <button onClick={reiniciar} className={`h-12 px-5 rounded-xl font-semibold text-sm shadow-sm active:scale-95 transition-all ${temaEscuro ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>Cancelar</button>
              <button onClick={() => aptoValido && avancarParaTamanho()} disabled={!aptoValido} className={`flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2 text-base active:scale-95 transition-all disabled:cursor-not-allowed ${aptoValido ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700' : temaEscuro ? 'bg-white/10 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>Próximo <ArrowRight className="w-4 h-4" /></button>
            </div>
            </div>
          </div>
        )}

        {/* ========== ETAPA: TAMANHO DO COMPARTIMENTO ========== */}
        {etapa === 'tamanho' && (() => {
          const tamanhos = (['P', 'M', 'G', 'GG'] as const)
          const barConfig: Record<string, { h: number; front: string; side: string; top: string; accent: string; label: string }> = {
            P:  { h: 80,  front: 'from-sky-500 to-sky-600',       side: 'from-sky-600 to-sky-700',       top: 'from-sky-400 to-sky-500',       accent: 'bg-sky-400',    label: 'sky' },
            M:  { h: 120, front: 'from-amber-500 to-amber-600',   side: 'from-amber-600 to-amber-700',   top: 'from-amber-400 to-amber-500',   accent: 'bg-amber-400',  label: 'amber' },
            G:  { h: 170, front: 'from-emerald-500 to-emerald-600', side: 'from-emerald-600 to-emerald-700', top: 'from-emerald-400 to-emerald-500', accent: 'bg-emerald-400', label: 'emerald' },
            GG: { h: 220, front: 'from-violet-500 to-violet-600', side: 'from-violet-600 to-violet-700', top: 'from-violet-400 to-violet-500', accent: 'bg-violet-400', label: 'violet' }
          }
          const maxH = 220

          return (
          <div key={animacaoKey} className="space-y-6 animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={voltar} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                temaEscuro 
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-bold tracking-[0.2em] uppercase truncate ${
                  temaEscuro ? 'text-[#1976FF]' : 'text-emerald-600'
                }`}>Bloco {blocoNormalizado || blocoDigitado} • Apto {aptoDigitado}</div>
                <div className={`text-xl sm:text-2xl font-extrabold truncate ${
                  temaEscuro ? 'text-white' : 'text-gray-900'
                }`}>Escolha o compartimento</div>
              </div>
            </div>

            {/* Verificar se todos estão esgotados */}
            {tamanhos.every(tam => portasDisponiveisPorTamanho[tam].length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-6xl sm:text-7xl font-black text-red-500/80 tracking-wider animate-pulse">
                  ESGOTADO
                </div>
              </div>
            )}

            {/* Gráfico de barras 3D */}
            <div className="relative">
              {/* Barras */}
              <div className="flex items-end gap-3" style={{ height: `${maxH + 40}px` }}>
                {tamanhos.map(tam => {
                  const cfg = barConfig[tam]
                  const qtd = portasDisponiveisPorTamanho[tam].length
                  const selecionado = tamanhoSelecionado === tam
                  const indisponivel = qtd === 0
                  return (
                    <button
                      key={tam}
                      onClick={() => selecionarTamanho(tam)}
                      disabled={indisponivel}
                      className={`group relative flex-1 flex flex-col items-center transition-all duration-300 ${
                        indisponivel ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
                      } ${selecionado ? 'scale-110 z-10' : tamanhoSelecionado && !indisponivel ? 'opacity-40 hover:opacity-70 hover:scale-[1.03]' : 'hover:scale-[1.03]'}`}
                    >
                      {/* Badge de disponibilidade (acima da barra) */}
                      <div className={`mb-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all duration-300 ${
                        indisponivel
                          ? 'bg-white/5 text-white/30'
                          : selecionado
                            ? `${cfg.accent} text-white shadow-lg`
                            : 'bg-white/10 text-white/50'
                      }`}>
                        {indisponivel ? '0' : qtd}
                      </div>

                      {/* Barra 3D */}
                      <div className="relative w-full" style={{ height: `${cfg.h}px` }}>
                        {/* Face frontal */}
                        <div className={`absolute inset-0 rounded-t-lg bg-gradient-to-b ${cfg.front} transition-all duration-300 ${
                          selecionado ? 'shadow-2xl ring-[3px] ring-white/70 brightness-110' : ''
                        }`}>
                          {/* Letra centrada na barra */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`font-extrabold text-white/90 transition-all ${
                              tam === 'GG' ? 'text-2xl' : 'text-3xl'
                            }`}>{tam}</span>
                          </div>
                        </div>

                        {/* Face lateral direita (efeito 3D) */}
                        <div
                          className={`absolute top-[6px] -right-[10px] w-[10px] rounded-tr-md bg-gradient-to-b ${cfg.side}`}
                          style={{ height: `${cfg.h}px` }}
                        />

                        {/* Face superior (efeito 3D) */}
                        <div className={`absolute -top-[6px] left-0 right-[-10px] h-[6px] bg-gradient-to-r ${cfg.top} rounded-t-md`}
                          style={{ clipPath: 'polygon(0 100%, 10px 0, 100% 0, calc(100% - 10px) 100%)' }}
                        />

                        {/* Brilho */}
                        <div className={`absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b rounded-t-lg transition-all duration-300 ${
                          selecionado ? 'from-white/30 to-transparent' : 'from-white/15 to-transparent'
                        }`} />

                        {/* Glow selecionado */}
                        {selecionado && (
                          <div className={`absolute -inset-2 rounded-xl bg-gradient-to-b ${cfg.front} opacity-25 blur-xl -z-10`} />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Base / plataforma */}
              <div className="relative mt-1">
                <div className="h-3 bg-gradient-to-b from-slate-600 to-slate-700 rounded-b-lg" />
                <div className="h-1.5 bg-gradient-to-b from-slate-700 to-slate-800 rounded-b-md mx-1" />
              </div>

              {/* Labels embaixo */}
              <div className="flex items-start gap-3 mt-3">
                {tamanhos.map(tam => {
                  const qtd = portasDisponiveisPorTamanho[tam].length
                  const selecionado = tamanhoSelecionado === tam
                  const indisponivel = qtd === 0

                  return (
                    <div key={tam} className="flex-1 text-center">
                      <div className={`text-xs font-extrabold transition-all ${
                        selecionado 
                          ? temaEscuro ? 'text-white' : 'text-gray-900'
                          : indisponivel 
                            ? temaEscuro ? 'text-white/20' : 'text-gray-400'
                            : temaEscuro ? 'text-white/60' : 'text-gray-600'
                      }`}>{tamanhoLabel[tam]}</div>
                      <div className={`text-[10px] mt-0.5 ${
                        indisponivel 
                          ? temaEscuro ? 'text-rose-400/60' : 'text-rose-600/80'
                          : selecionado 
                            ? temaEscuro ? 'text-emerald-400' : 'text-emerald-600'
                            : temaEscuro ? 'text-white/30' : 'text-gray-500'
                      }`}>
                        {indisponivel ? 'Esgotado' : `${qtd} livre${qtd > 1 ? 's' : ''}`}
                      </div>
                      <div className={`text-[9px] mt-0.5 leading-tight ${
                        indisponivel ? 'text-gray-300' : selecionado ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {tamanhoDesc[tam]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                onClick={reiniciar}
                className="h-16 px-6 rounded-2xl bg-white border border-gray-200 font-semibold text-sm text-gray-600 shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all duration-150 select-none flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={confirmarOcupacao}
                disabled={!tamanhoSelecionado || !portaSelecionada}
                className={`flex-1 h-16 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-150 text-lg select-none ${
                  tamanhoSelecionado && portaSelecionada
                    ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 active:scale-95'
                    : 'bg-white border border-gray-200 text-gray-400 shadow-sm cursor-not-allowed'
                }`}
              >
                <Package className="w-5 h-5" />
                Confirmar entrega
              </button>
            </div>
          </div>
          )
        })()}

        {/* ========== ETAPA: CONFIRMANDO ========== */}
        {etapa === 'confirmando' && (
          <div className="flex flex-col items-center justify-center py-16 px-6 gap-10">

            {/* Ícone animado */}
            <div className="relative">
              <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-500/20 animate-ping-slow" />
              <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-500/30 animate-ping-slow animation-delay-1000" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>
            </div>

            {/* Texto */}
            <div className="text-center space-y-2">
              <div className={`text-3xl font-black tracking-tight ${
                temaEscuro ? 'text-white' : 'text-gray-900'
              }`}>Abrindo o compartimento</div>
              <div className={`text-base font-medium ${
                temaEscuro ? 'text-white/60' : 'text-gray-400'
              }`}>Aguarde, estamos reservando o espaço para a encomenda</div>
            </div>

            {/* Etapas visuais */}
            <div className="w-full space-y-3">
              {[
                { label: 'Verificando disponibilidade', done: true },
                { label: 'Reservando compartimento', done: true },
                { label: 'Abrindo a porta', done: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-100 border-2 border-emerald-400'
                  }`}>
                    {step.done
                      ? <CheckCircle2 className="w-4 h-4" />
                      : <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                    }
                  </div>
                  <span className={`text-sm font-medium ${
                    step.done ? 'text-gray-700' : 'text-emerald-600'
                  }`}>{step.label}</span>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ========== ETAPA: SUCESSO ========== */}
        {etapa === 'sucesso' && (
          <div className="space-y-5">

            {/* === FASE 1: Aguardando entregador depositar === */}
            {!fechaduraConfirmada && (
              <div key={animacaoKey} className="flex flex-col items-center justify-center gap-6 py-8 px-4 animate-slide-in-right min-h-[60vh]">
                {/* Mensagem principal */}
                <div className="text-center">
                  <div className={`text-3xl sm:text-4xl font-black leading-tight whitespace-nowrap ${temaEscuro ? 'text-white' : 'text-gray-900'}`}>
                    Deposite a Mercadoria na PORTA <span className="text-[#1976FF]">{portaSelecionada?.numero_porta}</span>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex flex-col gap-5 max-w-md mx-auto w-full">
                  {/* Botão confirmar */}
                  <button
                    type="button"
                    onClick={fecharPortaAgora}
                    disabled={fechandoPortaAgora || !portaSelecionada}
                    className="relative w-full h-20 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-extrabold text-lg shadow-xl shadow-emerald-500/30 hover:from-emerald-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center overflow-hidden"
                  >
                    {!fechandoPortaAgora && (
                      <div
                        className="absolute inset-y-0 left-0 bg-white/15 transition-all duration-200 ease-linear"
                        style={{ width: `${progressoFechadura}%` }}
                      />
                    )}
                    <div className="relative flex items-center gap-3">
                      {fechandoPortaAgora ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Confirmando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Confirmar depósito</span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* Botão cancelar */}
                  <button
                    onClick={() => setModalCancelarAberto(true)}
                    disabled={fechandoPortaAgora}
                    className={`w-full h-14 rounded-2xl text-sm font-semibold transition-all shadow-md ${fechandoPortaAgora ? 'opacity-50 cursor-not-allowed' : ''} ${temaEscuro ? 'text-gray-400 bg-white/10 border border-white/20 hover:bg-white/20' : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'}`}
                  >
                    Cancelar
                  </button>
                </div>

              </div>
            )}

            {/* === FASE 2: Fechadura confirmada === */}
            {fechaduraConfirmada && (
              <div className="flex flex-col items-center text-center gap-8 py-8 px-2">

                {/* Ícone de sucesso */}
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl shadow-emerald-400/40">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>

                {/* Título + subtítulo */}
                <div className="space-y-2">
                  <div className={`text-4xl font-black leading-tight ${temaEscuro ? 'text-white' : 'text-gray-900'}`}>
                    Entrega confirmada!
                  </div>
                  <div className={`text-base font-medium ${temaEscuro ? 'text-gray-400' : 'text-gray-400'}`}>
                    Bloco {blocoNormalizado || blocoDigitado} · Apto {aptoDigitado} · Compartimento {portaSelecionada?.numero_porta}
                  </div>
                </div>

                {/* Botões */}
                <div className="w-full space-y-3 pt-2">
                  <button
                    onClick={() => setModalComprovanteAberto(true)}
                    className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-600 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Phone className="w-5 h-5" />
                    Receber comprovante
                  </button>

                  <button
                    onClick={reiniciar}
                    className="w-full h-14 rounded-2xl bg-white border border-gray-200 text-gray-600 font-semibold text-base shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Package className="w-5 h-5" />
                    Nova operação
                  </button>
                </div>

                {/* Contador auto-reiniciar */}
                <div className="w-full flex flex-col items-center gap-2 px-1">
                  <div className="w-full flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-400 font-medium">Reinício automático</span>
                    <span className="text-emerald-600 font-bold tabular-nums">
                      {Math.ceil(TEMPO_AUTO_REINICIAR - (progressoAutoReiniciar / 100) * TEMPO_AUTO_REINICIAR)}s
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-200 ease-linear shadow-sm"
                      style={{ width: `${progressoAutoReiniciar}%` }}
                    />
                  </div>
                </div>

              </div>
            )}

            {/* Modal comprovante (WhatsApp do entregador) */}
            {modalComprovanteAberto && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  type="button"
                  onClick={() => {
                    modalFechadoManualmente.current = true
                    setModalComprovanteAberto(false)
                  }}
                  className="absolute inset-0 bg-black/60"
                />
                <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[1.3rem] sm:text-[1.5rem] font-black text-gray-900">
                      Digite seu WhatsApp
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        modalFechadoManualmente.current = true
                        setModalComprovanteAberto(false)
                      }}
                      disabled={comprovanteEnviando}
                      className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className={`rounded-3xl border-2 p-3 sm:p-4 text-center transition-all mb-4 ${
                    whatsappEntregador ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className={`text-3xl sm:text-4xl font-black min-h-[40px] leading-none ${
                      whatsappEntregador ? 'text-gray-900' : 'text-gray-300'
                    }`}>
                      {formatarWhatsapp(whatsappEntregador) || '(00) 00000-0000'}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['1','2','3','4','5','6','7','8','9'].map(num => (
                      <button
                        key={num}
                        onClick={() => comprovanteDigit(num)}
                        disabled={comprovanteEnviando}
                        className="h-12 rounded-2xl bg-white border border-gray-200 text-gray-800 text-lg font-bold hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        modalFechadoManualmente.current = true
                        setModalComprovanteAberto(false)
                      }}
                      disabled={comprovanteEnviando}
                      className="h-12 rounded-2xl bg-white border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />Voltar
                    </button>
                    <button
                      onClick={() => comprovanteDigit('0')}
                      disabled={comprovanteEnviando}
                      className="h-12 rounded-2xl bg-white border border-gray-200 text-gray-800 text-lg font-bold hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      0
                    </button>
                    <button
                      onClick={comprovanteBackspace}
                      disabled={comprovanteEnviando}
                      className="h-12 rounded-2xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  </div>

                  {comprovanteErro && (
                    <div className="mb-4 text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-3 py-2">
                      {comprovanteErro}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={enviarComprovante}
                    disabled={whatsappEntregador.replace(/\D/g, '').length < 10 || comprovanteEnviando}
                    className="w-full h-11 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95"
                  >
                    {comprovanteEnviando ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar comprovante</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Modal de confirmação de cancelamento */}
            {modalCancelarAberto && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                <button
                  type="button"
                  onClick={() => setModalCancelarAberto(false)}
                  className="absolute inset-0 bg-black/60"
                />
                <div className="relative w-full sm:max-w-md bg-white border border-gray-200 rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-2xl font-black text-gray-900">Cancelar entrega?</div>
                    <button
                      type="button"
                      onClick={() => setModalCancelarAberto(false)}
                      className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="text-gray-500 text-sm mb-6">
                    Tem certeza que deseja cancelar esta entrega? A porta será liberada e você precisará começar novamente.
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={async () => {
                        if (portaSelecionada && !fechaduraConfirmada) {
                          try {
                            await atualizarStatusPorta(portaSelecionada.uid, 'DISPONIVEL')
                          } catch (err) {
                            console.warn('[PDV] Falha ao liberar porta no cancelamento:', err)
                          }
                        }
                        setModalCancelarAberto(false)
                        reiniciar()
                      }}
                      className="w-full h-14 rounded-2xl bg-rose-500 text-white font-bold text-lg shadow-lg hover:bg-rose-600 active:scale-95 transition-all"
                    >
                      Sim, cancelar
                    </button>
                    <button
                      onClick={() => setModalCancelarAberto(false)}
                      className="w-full h-14 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-base hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== ETAPA: ERRO DE FECHAMENTO (após porta aberta) ========== */}
        {etapa === 'erro_fechamento' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-50 to-orange-50 p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <div className="text-xl font-extrabold text-gray-900 mt-4">Não foi possível confirmar o fechamento</div>
              <div className="text-sm text-gray-500 mt-2 max-w-sm">
                O sistema não conseguiu verificar se a porta foi fechada corretamente.
                <br /><br />
                Verifique se a encomenda está dentro do compartimento e a porta está bem fechada.
                Se o problema persistir, solicite auxílio ao porteiro.
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full h-14 rounded-2xl font-extrabold flex items-center justify-center gap-2 transition-all text-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
            >
              <Sparkles className="w-5 h-5" />
              Reiniciar sistema
            </button>
          </div>
        )}

        {/* ========== ETAPA: ERRO ========== */}
        {etapa === 'erro' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-600/10 to-rose-900/20 p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <div className="text-xl font-extrabold text-white mt-4">Erro na operação</div>
              <div className="text-sm text-rose-300/70 mt-1">{mensagemErro || 'Não foi possível processar a entrega'}</div>
            </div>

            <button
              onClick={reiniciar}
              className="w-full h-14 rounded-2xl font-extrabold flex items-center justify-center gap-2 transition-all text-lg bg-white/10 text-white hover:bg-white/20"
            >
              Tentar novamente
            </button>
          </div>
        )}

      </div>
      </div>
    </div>
  )
}
