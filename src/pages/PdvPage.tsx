import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Package,
  Loader2,
  CheckCircle2,
  XCircle,
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
  Sparkles
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
  atualizarStatusFechaduraPorNumero,
  type Destinatario
} from '../services/gaveteiroService'
import type { Gaveteiro, Porta, Bloco, Apartamento } from '../types/gaveteiro'

type Etapa =
  | 'modo'
  | 'bloco_apto'
  | 'tamanho'
  | 'confirmando'
  | 'sucesso'
  | 'erro'
  | 'retirar_senha'
  | 'retirar_abrindo'
  | 'retirar_sucesso'
  | 'retirar_erro'
type Modo = 'entregar' | 'retirar' | null

export default function PdvPage() {
  const { usuario, condominio } = useAuth()

  // Estado geral
  const [etapa, setEtapa] = useState<Etapa>('modo')
  const [modo, setModo] = useState<Modo>(null)
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [mensagemErro, setMensagemErro] = useState('')

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
  const timerFechadura = useRef<ReturnType<typeof setInterval> | null>(null)
  const [progressoNovaOperacao, setProgressoNovaOperacao] = useState(0)
  const [cooldownNovaOperacaoAtivo, setCooldownNovaOperacaoAtivo] = useState(false)
  const timerNovaOperacao = useRef<ReturnType<typeof setInterval> | null>(null)
  const [modalComprovanteAberto, setModalComprovanteAberto] = useState(false)
  const [whatsappEntregador, setWhatsappEntregador] = useState('')
  const [fechandoPortaAgora, setFechandoPortaAgora] = useState(false)
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
    setLoading(true)
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
      if (blocoDigitado.length < 4) setBlocoDigitado(prev => prev + num)
    } else {
      if (aptoDigitado.length < 5) setAptoDigitado(prev => prev + num)
    }
  }

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
  }

  // Selecionar tamanho e porta
  const selecionarTamanho = (tamanho: 'P' | 'M' | 'G' | 'GG') => {
    const disponiveis = portasDisponiveisPorTamanho[tamanho]
    if (disponiveis.length === 0) return
    setTamanhoSelecionado(tamanho)
    // Seleciona a primeira porta disponível desse tamanho
    setPortaSelecionada(disponiveis[0])
  }

  // Confirmar ocupação
  const confirmarOcupacao = async () => {
    if (!portaSelecionada || !condominio?.uid) return

    setProcessando(true)
    setEtapa('confirmando')
    setMensagemErro('')

    try {
      const destinatarios: Destinatario[] = [{
        bloco: blocoNormalizado || blocoDigitado,
        apartamento: aptoDigitado,
        quantidade: 1
      }]

      const resultado = await ocuparPortaViaApi({
        portaUid: portaSelecionada.uid,
        condominioUid: condominio.uid,
        destinatarios,
        usuarioUid: usuario?.uid,
        observacao: `Ocupação via PDV - Armário ${tamanhoSelecionado}`
      })

      if (resultado.senhas) {
        setSenhasGeradas(resultado.senhas)
      }

      // Abrir porta
      const gaveteiro = gaveteiros.find(g => g.uid === portaSelecionada.gaveteiro_uid)
      if (gaveteiro?.esp32_ip) {
        try {
          await abrirPortaEsp32({ baseUrl: '/esp32', token: gaveteiro.esp32_token || 'teste', numeroPorta: portaSelecionada.numero_porta })
        } catch (err) {
          console.warn('[PDV] Erro ao abrir porta ESP32:', err)
        }
      }

      setEtapa('sucesso')
    } catch (err) {
      console.error('[PDV] Erro ao confirmar ocupação:', err)
      setMensagemErro(err instanceof Error ? err.message : 'Erro ao processar entrega')
      setEtapa('erro')
    } finally {
      setProcessando(false)
    }
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
        setFechaduraConfirmada(true)
        if (timerFechadura.current) clearInterval(timerFechadura.current)
      }
    }, 100)

    return () => {
      if (timerFechadura.current) {
        clearInterval(timerFechadura.current)
        timerFechadura.current = null
      }
    }
  }, [etapa])

  // Cooldown para liberar Nova operação após entrega confirmada
  const TEMPO_NOVA_OPERACAO = 90 // segundos
  useEffect(() => {
    if (etapa !== 'sucesso' || !fechaduraConfirmada) {
      if (timerNovaOperacao.current) {
        clearInterval(timerNovaOperacao.current)
        timerNovaOperacao.current = null
      }
      setCooldownNovaOperacaoAtivo(false)
      setProgressoNovaOperacao(0)
      return
    }

    setCooldownNovaOperacaoAtivo(true)
    setProgressoNovaOperacao(0)
    const inicio = Date.now()

    timerNovaOperacao.current = setInterval(() => {
      const elapsed = (Date.now() - inicio) / 1000
      const pct = Math.min((elapsed / TEMPO_NOVA_OPERACAO) * 100, 100)
      setProgressoNovaOperacao(pct)

      if (pct >= 100) {
        setCooldownNovaOperacaoAtivo(false)
        if (timerNovaOperacao.current) {
          clearInterval(timerNovaOperacao.current)
          timerNovaOperacao.current = null
        }
        setTimeout(() => {
          reiniciar()
        }, 300)
      }
    }, 200)

    return () => {
      if (timerNovaOperacao.current) {
        clearInterval(timerNovaOperacao.current)
        timerNovaOperacao.current = null
      }
    }
  }, [etapa, fechaduraConfirmada])

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
      console.log('[PDV SENSOR] Compartimento fechado detectado!')
      setFechaduraConfirmada(true)
      setProgressoFechadura(100)
      if (timerFechadura.current) {
        clearInterval(timerFechadura.current)
        timerFechadura.current = null
      }
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
    setProgressoNovaOperacao(0)
    setCooldownNovaOperacaoAtivo(false)
    setModalComprovanteAberto(false)
    setWhatsappEntregador('')
    if (timerFechadura.current) {
      clearInterval(timerFechadura.current)
      timerFechadura.current = null
    }
    if (timerNovaOperacao.current) {
      clearInterval(timerNovaOperacao.current)
      timerNovaOperacao.current = null
    }
    carregarDados()
  }

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
    const { senha, condominioUid } = parseSenhaFromQr(senhaRaw ?? senhaRetirada)
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
      setModalScannerAberto(true)

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
        const msg = err instanceof Error ? err.message : 'Não foi possível acessar a câmera para ler o QRCode'
        setRetiradaMensagem(msg || 'Não foi possível acessar a câmera para ler o QRCode')
      }
      setEtapa('retirar_erro')
    }
  }, [validarERetirar, pararScanner, cameraSelecionadaId, listarCameras])

  const irParaDigitacaoSenha = useCallback(() => {
    setModalScannerAberto(false)
    setTimeout(() => {
      senhaRetiradaInputRef.current?.focus()
    }, 120)
  }, [])

  useEffect(() => {
    if (modo === 'retirar' && etapa === 'retirar_senha') {
      if (!scannerAutoOpenedRef.current) {
        scannerAutoOpenedRef.current = true
        setTimeout(() => {
          iniciarScanner()
        }, 250)
      }
      return
    }
    scannerAutoOpenedRef.current = false
  }, [modo, etapa, iniciarScanner])

  useEffect(() => {
    if (!modalScannerAberto) {
      pararScanner()
    } else {
      listarCameras()
    }
    return () => {
      pararScanner()
    }
  }, [modalScannerAberto, pararScanner, listarCameras])

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
    if (!portaSelecionada) return

    const gaveteiro = gaveteiros.find(g => g.uid === portaSelecionada.gaveteiro_uid)
    if (!gaveteiro?.esp32_ip) {
      alert('ESP32 não configurado para este gaveteiro. Configure o campo esp32_ip no cadastro do gaveteiro.')
      return
    }

    if (fechandoPortaAgora) return

    setFechandoPortaAgora(true)
    try {
      const resp = await fecharPortaEsp32({
        baseUrl: '/esp32',
        token: gaveteiro.esp32_token || 'teste',
        numeroPorta: portaSelecionada.numero_porta,
        timeoutMs: 10000
      })

      if (!resp?.ok) {
        throw new Error(resp?.message || 'Falha ao fechar a porta')
      }

      try {
        await atualizarStatusFechaduraPorNumero(
          portaSelecionada.gaveteiro_uid,
          portaSelecionada.numero_porta,
          'fechada'
        )
      } catch (err) {
        console.warn('[PDV] Falha ao atualizar status da fechadura no banco:', err)
      }

      setFechaduraConfirmada(true)
      setProgressoFechadura(100)
      if (timerFechadura.current) {
        clearInterval(timerFechadura.current)
        timerFechadura.current = null
      }
    } catch (err) {
      console.error('[PDV] Erro ao fechar porta via ESP32:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao fechar a porta'
      alert(msg)
    } finally {
      setFechandoPortaAgora(false)
    }
  }, [portaSelecionada, gaveteiros, fechandoPortaAgora])

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
      setEtapa('bloco_apto')
      setTamanhoSelecionado(null)
      setPortaSelecionada(null)
    } else if (etapa === 'bloco_apto') {
      setEtapa('modo')
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-extrabold text-white/80 animate-pulse">Ajustando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6 overflow-auto">
      <div className={`w-full ${etapa === 'modo' || etapa === 'bloco_apto' || etapa === 'tamanho' || etapa === 'sucesso' ? 'max-w-2xl' : 'max-w-lg'} transition-all`}>

        {/* ========== ETAPA: MODO (ENTREGAR / RETIRAR) ========== */}
        {etapa === 'modo' && (
          <div className="max-w-5xl mx-auto px-4 py-10">
            <div className="text-center mb-10">
              <div className="text-sm font-bold tracking-[0.3em] text-white/30 uppercase">PDV Armários</div>
              <div className="text-3xl font-extrabold text-white mt-2">O que deseja fazer?</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => {
                  setModo('entregar')
                  setEtapa('bloco_apto')
                }}
                className="group relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/20 to-green-600/20 p-8 text-left hover:from-emerald-600/30 hover:to-green-600/30 transition-all hover:shadow-xl hover:shadow-emerald-500/20"
              >
                <div className="flex flex-col items-center justify-center gap-5">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-xl shadow-emerald-500/25">
                    <Inbox className="w-12 h-12 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">Entregar</div>
                    <div className="text-sm text-emerald-300/80 mt-1">Depositar encomenda</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModo('retirar')
                  setEtapa('retirar_senha')
                  setRetiradaMensagem('')
                  setRetiradaPortaInfo(null)
                  setSenhaRetirada('')
                }}
                className="group relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 p-8 text-left hover:from-blue-600/30 hover:to-indigo-600/30 transition-all hover:shadow-xl hover:shadow-blue-500/20"
              >
                <div className="flex flex-col items-center justify-center gap-5">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
                    <ShoppingCart className="w-12 h-12 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">Retirar</div>
                    <div className="text-sm text-blue-300/80 mt-1">Retirar encomenda</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_senha' && (
          <div className="max-w-5xl mx-auto px-4 py-10">
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => reiniciar()}
                className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/15 active:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5 mx-auto" />
              </button>
              <div>
                <div className="text-sm text-white/60">Retirada</div>
                <div className="text-2xl font-extrabold">Leia o QRCode ou digite a senha</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-white font-extrabold">Senha</div>
                  <button
                    type="button"
                    onClick={iniciarScanner}
                    className="h-11 px-4 rounded-2xl bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Ler QRCode
                    </span>
                  </button>
                </div>

                <input
                  ref={senhaRetiradaInputRef}
                  value={senhaRetirada}
                  onChange={(e) => setSenhaRetirada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') validarERetirar()
                  }}
                  autoFocus
                  placeholder="Aproxime o QRCode ou digite a senha"
                  className="w-full h-14 rounded-2xl bg-black/30 border border-white/10 px-4 text-lg tracking-widest"
                />

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => validarERetirar()}
                    disabled={retiradaProcessando}
                    className="flex-1 h-12 rounded-2xl bg-blue-500/20 hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {retiradaProcessando ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                      Validar e abrir
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLimparRetirada}
                    disabled={retiradaProcessando}
                    className="w-20 h-12 rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Limpar
                  </button>
                </div>

                {retiradaMensagem && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-white/80">
                    {retiradaMensagem}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-white font-extrabold mb-4">Painel numérico</div>
                <div className="grid grid-cols-3 gap-3">
                  {['1','2','3','4','5','6','7','8','9'].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleNumpadRetirada(n)}
                      disabled={retiradaProcessando}
                      className="h-16 rounded-2xl bg-white/10 hover:bg-white/15 active:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-extrabold"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleBackspaceRetirada}
                    disabled={retiradaProcessando}
                    className="h-16 rounded-2xl bg-white/10 hover:bg-white/15 active:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Delete className="w-6 h-6 mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpadRetirada('0')}
                    disabled={retiradaProcessando}
                    className="h-16 rounded-2xl bg-white/10 hover:bg-white/15 active:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-extrabold"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => validarERetirar()}
                    disabled={retiradaProcessando}
                    className="h-16 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-6 h-6 mx-auto" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_abrindo' && (
          <div className="max-w-3xl mx-auto px-4 py-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-white/80" />
              <div className="mt-4 text-2xl font-extrabold">Processando retirada</div>
              <div className="mt-2 text-white/70">{retiradaMensagem || 'Aguarde...'}</div>
            </div>
          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_sucesso' && (
          <div className="max-w-3xl mx-auto px-4 py-16">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-200" />
              <div className="mt-4 text-2xl font-extrabold">Retirada liberada</div>
              <div className="mt-2 text-white/80">{retiradaMensagem}</div>
              {retiradaPortaInfo && (
                <div className="mt-4 text-white/70">
                  Compartimento: <span className="font-extrabold text-white">{retiradaPortaInfo.numero_porta}</span>
                </div>
              )}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => reiniciar()}
                  className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/15"
                >
                  Nova operação
                </button>
              </div>
            </div>
          </div>
        )}

        {modo === 'retirar' && etapa === 'retirar_erro' && (
          <div className="max-w-3xl mx-auto px-4 py-16">
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-center">
              <XCircle className="w-10 h-10 mx-auto text-rose-200" />
              <div className="mt-4 text-2xl font-extrabold">Não foi possível liberar</div>
              <div className="mt-2 text-white/80">{retiradaMensagem || 'Tente novamente.'}</div>
              <div className="mt-6 flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setEtapa('retirar_senha')
                    setRetiradaMensagem('')
                  }}
                  className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/15"
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={() => reiniciar()}
                  className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/15"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        {modalScannerAberto && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <button
              type="button"
              onClick={() => setModalScannerAberto(false)}
              className="absolute inset-0 bg-black/60"
            />
            <div className="relative w-full sm:max-w-lg bg-slate-950/90 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white font-extrabold">Leitor de QRCode</div>
                <button
                  type="button"
                  onClick={() => setModalScannerAberto(false)}
                  className="w-10 h-10 rounded-2xl bg-white/10 text-white/70 hover:bg-white/15"
                >
                  <XCircle className="w-5 h-5 mx-auto" />
                </button>
              </div>

              {camerasDisponiveis.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Câmera</div>
                  <select
                    value={cameraSelecionadaId}
                    onChange={(e) => {
                      const id = e.target.value
                      setCameraSelecionadaId(id)
                      setTimeout(() => {
                        iniciarScanner(id)
                      }, 50)
                    }}
                    className="w-full h-12 rounded-2xl bg-black/30 border border-white/10 px-3 text-white"
                  >
                    {camerasDisponiveis.map(c => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                <video ref={videoRef} className="w-full h-64 sm:h-72 object-cover" muted playsInline />
              </div>
              <div className="mt-4 text-white/70">Aponte a câmera para o QRCode do morador.</div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={irParaDigitacaoSenha}
                  className="flex-1 h-12 rounded-2xl bg-white/10 hover:bg-white/15"
                >
                  Digitar senha
                </button>
                <button
                  type="button"
                  onClick={() => iniciarScanner(cameraSelecionadaId)}
                  className="flex-1 h-12 rounded-2xl bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25"
                >
                  Reiniciar câmera
                </button>
              </div>
            </div>
          </div>
        )}

        {etapa === 'bloco_apto' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={voltar} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase">Entregar</div>
                <div className="text-xl sm:text-2xl font-extrabold text-white">Informe o destino</div>
              </div>
            </div>

            {/* Campos Bloco e Apartamento */}
            <div className="grid grid-cols-2 gap-4">
              {/* Bloco */}
              <button
                onClick={() => setCampoAtivo('bloco')}
                className={`rounded-3xl border-2 p-6 text-left transition-all ${
                  campoAtivo === 'bloco'
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : blocoValido
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className={`w-5 h-5 ${campoAtivo === 'bloco' ? 'text-emerald-400' : blocoValido ? 'text-emerald-500' : 'text-white/40'}`} />
                  <span className={`text-xs font-bold tracking-wider uppercase ${campoAtivo === 'bloco' ? 'text-emerald-400' : blocoValido ? 'text-emerald-500' : 'text-white/40'}`}>Bloco</span>
                  {blocoValido && <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />}
                </div>
                <div className={`text-3xl sm:text-4xl font-black min-h-[48px] ${
                  blocoDigitado ? 'text-white' : 'text-white/20'
                }`}>
                  {blocoDigitado || '—'}
                </div>
                {blocoDigitado && !blocoValido && (
                  <div className="text-xs font-semibold text-rose-400 mt-2">Bloco não encontrado</div>
                )}
              </button>

              {/* Apartamento */}
              <button
                onClick={() => setCampoAtivo('apto')}
                className={`rounded-3xl border-2 p-6 text-left transition-all ${
                  campoAtivo === 'apto'
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : aptoValido
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Home className={`w-5 h-5 ${campoAtivo === 'apto' ? 'text-emerald-400' : aptoValido ? 'text-emerald-500' : 'text-white/40'}`} />
                  <span className={`text-xs font-bold tracking-wider uppercase ${campoAtivo === 'apto' ? 'text-emerald-400' : aptoValido ? 'text-emerald-500' : 'text-white/40'}`}>Apto</span>
                  {aptoValido && <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />}
                </div>
                <div className={`text-3xl sm:text-4xl font-black min-h-[48px] ${
                  aptoDigitado ? 'text-white' : 'text-white/20'
                }`}>
                  {aptoDigitado || '—'}
                </div>
                {aptoDigitado && !aptoValido && blocoValido && (
                  <div className="text-xs font-semibold text-rose-400 mt-2">Apto não encontrado</div>
                )}
              </button>
            </div>

            {/* Seleção de bloco por letras (quando condomínio usa letras) */}
            {blocosEhLetras && campoAtivo === 'bloco' && (
              <div>
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">Selecione o bloco</div>
                <div className="flex flex-wrap gap-2">
                  {blocosUnicos.map(b => (
                    <button
                      key={b}
                      onClick={() => {
                        setBlocoDigitado(b)
                        setCampoAtivo('apto')
                      }}
                      className={`h-12 min-w-[48px] px-4 rounded-xl font-extrabold text-lg transition-all ${
                        blocoDigitado === b
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                          : 'bg-white/10 text-white hover:bg-white/20 active:bg-white/30'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Teclado numérico (para bloco numérico ou sempre para apto) */}
            {(!blocosEhLetras || campoAtivo === 'apto') && (
              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9'].map(num => (
                  <button
                    key={num}
                    onClick={() => handleNumpad(num)}
                    className="h-16 rounded-2xl bg-white/10 text-white text-2xl font-black hover:bg-white/20 active:bg-white/30 transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleLimpar}
                  className="h-16 rounded-2xl bg-rose-500/20 text-rose-300 text-sm font-bold hover:bg-rose-500/30 active:bg-rose-500/40 transition-colors"
                >
                  Limpar
                </button>
                <button
                  onClick={() => handleNumpad('0')}
                  className="h-16 rounded-2xl bg-white/10 text-white text-2xl font-black hover:bg-white/20 active:bg-white/30 transition-colors"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-16 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors"
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>
            )}

            {/* Botão avançar */}
            <button
              onClick={avancarParaTamanho}
              disabled={!blocoValido || !aptoValido}
              className="w-full h-16 rounded-3xl font-extrabold flex items-center justify-center gap-2 transition-all text-xl disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-xl hover:from-emerald-700 hover:to-green-700"
            >
              Continuar
              <ArrowRight className="w-6 h-6" />
            </button>
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
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={voltar} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase">Bloco {blocoNormalizado || blocoDigitado} • Apto {aptoDigitado}</div>
                <div className="text-xl sm:text-2xl font-extrabold text-white">Escolha o compartimento</div>
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
                        selecionado ? 'text-white' : indisponivel ? 'text-white/20' : 'text-white/60'
                      }`}>{tamanhoLabel[tam]}</div>
                      <div className={`text-[10px] mt-0.5 ${
                        indisponivel ? 'text-rose-400/60' : selecionado ? 'text-emerald-400' : 'text-white/30'
                      }`}>
                        {indisponivel ? 'Esgotado' : `${qtd} livre${qtd > 1 ? 's' : ''}`}
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
                className="h-14 px-5 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all text-sm bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80"
              >
                <XCircle className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={confirmarOcupacao}
                disabled={!tamanhoSelecionado || !portaSelecionada}
                className={`flex-1 h-14 rounded-2xl font-extrabold flex items-center justify-center gap-2 transition-all duration-300 text-lg ${
                  tamanhoSelecionado && portaSelecionada
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg hover:from-emerald-700 hover:to-green-700'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
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
          <div className="flex flex-col items-center justify-center py-20 px-6">
            {/* Animação de pulso com círculos concêntricos */}
            <div className="relative">
              <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-500/20 animate-ping-slow" />
              <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-500/30 animate-ping-slow animation-delay-1000" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>
            </div>
            <div className="mt-12 text-center">
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">Processando entrega</div>
              <div className="text-base sm:text-lg text-emerald-300/80 mt-6 font-medium">Aguarde um momento</div>
            </div>
          </div>
        )}

        {/* ========== ETAPA: SUCESSO ========== */}
        {etapa === 'sucesso' && (
          <div className="space-y-5">

            {/* === FASE 1: Aguardando entregador depositar === */}
            {!fechaduraConfirmada && (
              <div className="space-y-12">
                {/* Header padrão como outras etapas */}
                <div className="flex items-center gap-6">
                  <button onClick={voltar} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase">Bloco {blocoNormalizado || blocoDigitado} • Apto {aptoDigitado}</div>
                    <div className="text-xl sm:text-2xl font-extrabold text-white">Deposite a mercadoria</div>
                  </div>
                </div>

                {/* Card principal com destaque máximo */}
                <div className="rounded-3xl border-2 border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-green-600/10 p-10 sm:p-12 shadow-2xl">
                  <div className="text-center">
                    {portaSelecionada && (
                      <div className="flex flex-col items-center gap-12">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                            <div className="text-2xl sm:text-3xl font-black text-white leading-none">
                              {portaSelecionada.numero_porta}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                          <div className="text-2xl sm:text-3xl font-black text-white text-center leading-tight">
                            Coloque a mercadoria<br/>no compartimento {portaSelecionada.numero_porta}
                          </div>
                          <div className="text-sm text-emerald-300/90 text-center font-medium">
                            Após depositar, feche a porta para finalizar
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões no padrão do app */}
                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={fecharPortaAgora}
                    disabled={fechandoPortaAgora || !portaSelecionada}
                    className="relative flex-1 h-16 sm:h-18 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-extrabold text-xl sm:text-2xl shadow-lg hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 overflow-hidden"
                  >
                    {!fechandoPortaAgora && (
                      <div
                        className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-200 ease-linear"
                        style={{ width: `${progressoFechadura}%` }}
                      />
                    )}
                    {fechandoPortaAgora ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Fechando...</span>
                      </>
                    ) : (
                      <>
                        <Package className="w-6 h-6" />
                        <span>Fechar porta</span>
                        <span className="text-base sm:text-lg opacity-80">
                          ({Math.ceil(TEMPO_FECHADURA - (progressoFechadura / 100) * TEMPO_FECHADURA)}s)
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={reiniciar}
                    className="h-16 sm:h-18 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-base sm:text-lg bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 whitespace-nowrap"
                  >
                    <XCircle className="w-6 h-6" />
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* === FASE 2: Fechadura confirmada === */}
            {fechaduraConfirmada && (
              <div className="space-y-10">
                {/* Ícone de sucesso */}
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div className="text-center space-y-6">
                  <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">Entrega confirmada!</div>
                  <div className="text-base sm:text-lg text-emerald-300/70 font-semibold">
                    Bloco {blocoNormalizado || blocoDigitado} • Apto {aptoDigitado} • Compartimento {portaSelecionada?.numero_porta}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <button
                    onClick={reiniciar}
                    disabled={cooldownNovaOperacaoAtivo}
                    className={`relative h-20 px-12 rounded-2xl font-extrabold flex items-center justify-center gap-3 transition-all text-xl overflow-hidden shadow-xl ${
                      cooldownNovaOperacaoAtivo
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg hover:from-emerald-700 hover:to-green-700'
                    }`}
                  >
                    {cooldownNovaOperacaoAtivo && (
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600/30 to-green-600/30"
                        style={{ width: `${progressoNovaOperacao}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-center gap-3">
                      <Package className="w-6 h-6" />
                      {cooldownNovaOperacaoAtivo
                        ? `Nova operação (${Math.ceil(TEMPO_NOVA_OPERACAO - (progressoNovaOperacao / 100) * TEMPO_NOVA_OPERACAO)}s)`
                        : 'Nova operação'
                      }
                    </div>
                  </button>

                  <button
                    onClick={() => setModalComprovanteAberto(true)}
                    className="h-20 px-10 rounded-2xl font-extrabold flex items-center justify-center gap-3 transition-all text-base bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
                  >
                    <Phone className="w-6 h-6" />
                    Comprovante
                  </button>
                </div>
              </div>
            )}

            {/* Modal comprovante (WhatsApp do entregador) */}
            {modalComprovanteAberto && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                <button
                  type="button"
                  onClick={() => setModalComprovanteAberto(false)}
                  className="absolute inset-0 bg-black/60"
                />
                <div className="relative w-full sm:max-w-2xl bg-slate-950/90 border border-white/10 rounded-t-3xl sm:rounded-3xl p-8 sm:p-10 backdrop-blur">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-2xl sm:text-3xl font-black text-white">Comprovante</div>
                    <button
                      type="button"
                      onClick={() => setModalComprovanteAberto(false)}
                      disabled={comprovanteEnviando}
                      className="w-12 h-12 rounded-2xl bg-white/10 text-white/70 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-6 h-6 mx-auto" />
                    </button>
                  </div>

                  <div className="text-white/70 text-base sm:text-lg mb-6">
                    Digite seu WhatsApp para receber o comprovante da entrega
                  </div>

                  <div className="w-full h-16 sm:h-18 rounded-3xl bg-white/10 border-2 border-white/15 flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl mb-6">
                    {formatarWhatsapp(whatsappEntregador) || '(00) 00000-0000'}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {['1','2','3','4','5','6','7','8','9'].map(num => (
                      <button
                        key={num}
                        onClick={() => comprovanteDigit(num)}
                        disabled={comprovanteEnviando}
                        className="h-16 sm:h-18 rounded-2xl bg-white/10 text-white text-2xl sm:text-3xl font-black hover:bg-white/20 active:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={comprovanteClear}
                      disabled={comprovanteEnviando}
                      className="h-16 sm:h-18 rounded-2xl bg-white/10 text-white/80 text-sm font-extrabold hover:bg-white/20 active:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={() => comprovanteDigit('0')}
                      disabled={comprovanteEnviando}
                      className="h-16 sm:h-18 rounded-2xl bg-white/10 text-white text-2xl sm:text-3xl font-black hover:bg-white/20 active:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      0
                    </button>
                    <button
                      onClick={comprovanteBackspace}
                      disabled={comprovanteEnviando}
                      className="h-16 sm:h-18 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Delete className="w-6 h-6" />
                    </button>
                  </div>

                  {comprovanteErro && (
                    <div className="mb-6 text-sm font-bold text-rose-400/90 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3">
                      {comprovanteErro}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={enviarComprovante}
                    disabled={whatsappEntregador.replace(/\D/g, '').length < 10 || comprovanteEnviando}
                    className="w-full h-16 sm:h-18 rounded-3xl font-extrabold flex items-center justify-center gap-3 transition-all text-xl sm:text-2xl disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-xl hover:from-emerald-700 hover:to-green-700"
                  >
                    {comprovanteEnviando ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-6 h-6" />
                        <span>Enviar comprovante</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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
  )
}
