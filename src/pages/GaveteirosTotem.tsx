import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRouter } from 'next/router'
import QRCode from 'react-qr-code'
import { 
  Package, 
  Loader2, 
  DoorOpen, 
  CheckCircle2, 
  XCircle, 
  X,
  ChevronRight,
  ChevronLeft,
  Home,
  Building2,
  Copy,
  RotateCcw,
  LogOut,
  Search,
  Trash2,
  Lock,
  Unlock,
  User,
  Inbox,
  Maximize2,
  Minimize2,
  ShoppingCart,
  ArrowRight,
  ArrowLeft,
  Send,
  Phone
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { 
  listarGaveteiros, 
  listarPortas, 
  listarBlocos, 
  listarApartamentos,
  listarMoradores,
  ocuparPortaViaApi,
  abrirPortaEsp32,
  solicitarAberturaPortaIot,
  atualizarSensorImaPorNumero,
  type Destinatario,
  type SenhaDestinatario
} from '../services/gaveteiroService'
import type { Gaveteiro, Porta, Bloco, Apartamento, Morador } from '../types/gaveteiro'

type Etapa = 'inicio' | 'selecionar_bloco' | 'selecionar_apartamento' | 'selecionar_porta' | 'confirmando' | 'sucesso' | 'erro'

interface DestinatarioItem {
  bloco: string
  apartamento: string
  quantidade: number
}

export default function GaveteirosTotem({ mode = 'kiosk' }: { mode?: 'embedded' | 'kiosk' }) {
  const { usuario, condominio, logout } = useAuth()
  
  // Try to get Next.js router first (for Next.js pages)
  let nextRouter = null
  try {
    nextRouter = useRouter()
  } catch (e) {
    // Not in Next.js environment
  }
  
  // Try to get React Router navigate function
  let reactNavigate = null
  try {
    reactNavigate = useNavigate()
  } catch (e) {
    // Not in React Router environment
  }
  
  // Create a unified navigate function that works in both environments
  const navigate = (path: string) => {
    if (reactNavigate) {
      reactNavigate(path)
    } else if (nextRouter && typeof nextRouter.push === 'function') {
      nextRouter.push(path)
    } else {
      console.warn('No router available for navigation')
    }
  }

  const stripLeadingZeros = (v: string) => String(v || '').replace(/^0+(?!$)/, '')
  const normalizeBlocoCandidates = (bloco?: string | null) => {
    const blocoNorm = typeof bloco === 'string' ? bloco.trim() : ''
    if (!blocoNorm) return [] as string[]

    const digits = blocoNorm.match(/\d+/)?.[0] ?? ''
    const digitsNoZero = digits ? stripLeadingZeros(digits) : ''
    const digits2 = digitsNoZero ? digitsNoZero.padStart(2, '0') : ''

    return Array.from(
      new Set(
        [
          blocoNorm,
          stripLeadingZeros(blocoNorm),
          digits,
          digitsNoZero,
          digits2,
          digits2 ? `Bloco ${digits2}` : '',
          digitsNoZero ? `Bloco ${digitsNoZero}` : ''
        ].filter(Boolean)
      )
    )
  }

  const normalizeAptoCandidates = (apto?: string | null) => {
    const aptoNorm = typeof apto === 'string' ? apto.trim() : ''
    if (!aptoNorm) return [] as string[]
    return Array.from(new Set([aptoNorm, stripLeadingZeros(aptoNorm)].filter(Boolean)))
  }

  const isKiosk = mode === 'kiosk'
  const embeddedBleedClass = isKiosk
    ? ''
    : '-m-4 sm:-m-6 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] max-w-none'
  const KIOSK_IDLE_MS = 2 * 60 * 1000
  const KIOSK_SLIDE_INTERVAL_MS = 12_000
  const KIOSK_SCREENSAVER_VIDEO_URL = process.env.NEXT_PUBLIC_KIOSK_SCREENSAVER_VIDEO_URL as string | undefined
  const KIOSK_SCREENSAVER_IMAGE_URL = process.env.NEXT_PUBLIC_KIOSK_SCREENSAVER_IMAGE_URL as string | undefined
  const KIOSK_MANUFACTURER_LOGO_URL = process.env.NEXT_PUBLIC_KIOSK_MANUFACTURER_LOGO_URL as string | undefined
  const kioskSlides = [
    {
      variant: 'brand',
      icon: Package,
      title: 'AIRE',
      subtitle: 'Armário inteligente de recebimento e entrega',
      durationMs: 18_000,
      manufacturerLogoUrl:
        KIOSK_MANUFACTURER_LOGO_URL ||
        '/logo jm redonda.png',
      items: ['WhatsApp: 81 9 7914-6126']
    },
    {
      icon: Lock,
      title: 'Benefícios para o condomínio',
      subtitle: 'Mais segurança, mais agilidade e mais valorização',
      durationMs: 12_000,
      items: [
        'Mais segurança para sua mercadoria e menos burocracia para a portaria',
        'Morador retira a mercadoria 24 horas com senha provisória',
        'Mais valorização para o condomínio com a AIRE'
      ]
    },
    {
      icon: User,
      title: 'Como funciona (Entregador)',
      subtitle: 'Apenas 3 passos no painel',
      durationMs: 12_000,
      items: [
        '1) Entregador chega na portaria e digita Bloco e Apartamento',
        '2) Escolhe o gaveteiro/porta e deposita a mercadoria',
        '3) Pronto. Processo rápido e padronizado'
      ]
    },
    {
      icon: Inbox,
      title: 'Como funciona (Morador)',
      subtitle: 'Aviso no celular e retirada com segurança',
      durationMs: 12_000,
      items: [
        'Morador recebe mensagem no celular informando que a mercadoria já está no gaveteiro',
        'Recebe uma senha provisória para retirada',
        'O gaveteiro abre e o morador retira a mercadoria'
      ]
    },
    {
      icon: Building2,
      title: 'Para a administração',
      subtitle: 'Controle e relatórios completos',
      durationMs: 12_000,
      items: [
        'Controle e relatório de tudo que recebe e entrega',
        'Relatórios diário, semanal, anual e total',
        'Mais agilidade no processo com a AIRE'
      ]
    }
  ]
  const [protecaoTelaAtiva, setProtecaoTelaAtiva] = useState(false)
  const [copiadoComprovante, setCopiadoComprovante] = useState(false)
  const [whatsappEntregador, setWhatsappEntregador] = useState('')
  const [enviandoWhatsappEntregador, setEnviandoWhatsappEntregador] = useState(false)
  const [whatsappEntregadorEnviado, setWhatsappEntregadorEnviado] = useState(false)
  const [whatsappEntregadorErro, setWhatsappEntregadorErro] = useState('')
  const [kioskSlideIndex, setKioskSlideIndex] = useState(0)
  const kioskSlideIndexRef = useRef(0)
  const [kioskSlideAnimating, setKioskSlideAnimating] = useState(false)
  const [kioskSlideFromIndex, setKioskSlideFromIndex] = useState(0)
  const [kioskSlideToIndex, setKioskSlideToIndex] = useState(0)
  const [kioskSlidePhase, setKioskSlidePhase] = useState<'prep' | 'run' | 'idle'>('idle')
  const [kioskSlidePaused, setKioskSlidePaused] = useState(false)
  const longPressTimeoutRef = useRef<number | null>(null)
  const longPressedRef = useRef(false)
  const wakeLockRef = useRef<any>(null)
  const slideAdvanceTimeoutRef = useRef<number | null>(null)
  const brandTitleRef = useRef<HTMLDivElement | null>(null)
  const brandSubtitleRef = useRef<HTMLDivElement | null>(null)
  const brandWhatsRef = useRef<HTMLDivElement | null>(null)
  const brandLogoRef = useRef<HTMLImageElement | null>(null)
  const kioskIdleTimeoutRef = useRef<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [etapa, setEtapa] = useState<Etapa>(() => (isKiosk ? 'inicio' : 'selecionar_bloco'))
  const [mostrarRevisao, setMostrarRevisao] = useState(false)
  const [autoFinalizarEm, setAutoFinalizarEm] = useState<number | null>(null)
  const [portaPage, setPortaPage] = useState(1)
  const [portaPageSize, setPortaPageSize] = useState(60)
  
  // Dados
  const [gaveteiros, setGaveteiros] = useState<Gaveteiro[]>([])
  const [portas, setPortas] = useState<Porta[]>([])
  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [moradores, setMoradores] = useState<Morador[]>([])

  const moradoresIndex = useMemo(() => {
    const index = new Set<string>()
    for (const m of moradores) {
      const blocoCands = normalizeBlocoCandidates((m as any).bloco)
      const aptoCands = normalizeAptoCandidates((m as any).apartamento)
      for (const b of blocoCands) {
        for (const a of aptoCands) {
          index.add(`${b}::${a}`)
        }
      }
    }
    return index
  }, [moradores])
  
  // Seleções - MÚLTIPLOS DESTINATÁRIOS
  const [blocoSelecionado, setBlocoSelecionado] = useState<string>('')
  const [destinoAtivo, setDestinoAtivo] = useState<{ bloco: string; apartamento: string } | null>(null)
  const [destinatarios, setDestinatarios] = useState<DestinatarioItem[]>([])
  const [portaSelecionada, setPortaSelecionada] = useState<Porta | null>(null)
  
  // Resultado
  const [senhasGeradas, setSenhasGeradas] = useState<SenhaDestinatario[]>([])
  const [mensagemErro, setMensagemErro] = useState('')
  const [processando, setProcessando] = useState(false)
  const [cancelandoOperacao, setCancelandoOperacao] = useState(false)
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false)
  const [mensagemConfirmarFechamento, setMensagemConfirmarFechamento] = useState('')
  const [finalizadoEm, setFinalizadoEm] = useState<number | null>(null)
  const sensorPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoConfirmacaoDepositoRef = useRef(false)
  const [depositoDeadline, setDepositoDeadline] = useState<number | null>(null)
  const [depositoRestanteMs, setDepositoRestanteMs] = useState<number>(0)
  
  // Busca
  const [buscaBloco, setBuscaBloco] = useState('')
  const [buscaApto, setBuscaApto] = useState('')
  const [blocosCarrinhoExpandidos, setBlocosCarrinhoExpandidos] = useState<Set<string>>(new Set())
  const [mostrarConfirmacaoPorta, setMostrarConfirmacaoPorta] = useState(false)
  const [portaEmConfirmacao, setPortaEmConfirmacao] = useState<Porta | null>(null)

  useEffect(() => {
    if (!isKiosk) return

    const limparTimeout = () => {
      if (kioskIdleTimeoutRef.current) {
        window.clearTimeout(kioskIdleTimeoutRef.current)
        kioskIdleTimeoutRef.current = null
      }
    }

    const programarTimeout = () => {
      limparTimeout()
      kioskIdleTimeoutRef.current = window.setTimeout(() => {
        setProtecaoTelaAtiva(true)
      }, KIOSK_IDLE_MS)
    }

    const registrarAtividade = (event?: Event) => {
      if (protecaoTelaAtiva) {
        if (event?.type === 'keydown') setProtecaoTelaAtiva(false)
        return
      }
      programarTimeout()
    }

    programarTimeout()

    const opts: AddEventListenerOptions = { passive: true }
    window.addEventListener('pointerdown', registrarAtividade, opts)
    window.addEventListener('pointermove', registrarAtividade, opts)
    window.addEventListener('keydown', registrarAtividade, opts)
    window.addEventListener('touchstart', registrarAtividade, opts)
    window.addEventListener('wheel', registrarAtividade, opts)

    return () => {
      limparTimeout()
      window.removeEventListener('pointerdown', registrarAtividade)
      window.removeEventListener('pointermove', registrarAtividade)
      window.removeEventListener('keydown', registrarAtividade)
      window.removeEventListener('touchstart', registrarAtividade)
      window.removeEventListener('wheel', registrarAtividade)
    }
  }, [isKiosk, protecaoTelaAtiva])

  useEffect(() => {
    if (!isKiosk) return

    const requestWakeLock = async () => {
      try {
        if (!(navigator as any)?.wakeLock?.request) return
        if (document.visibilityState !== 'visible') return
        if (wakeLockRef.current) return

        const sentinel = await (navigator as any).wakeLock.request('screen')
        wakeLockRef.current = sentinel

        sentinel?.addEventListener?.('release', () => {
          wakeLockRef.current = null
        })
      } catch (error) {
        console.warn('[Totem] Wake Lock indisponível/negado:', error)
      }
    }

    const releaseWakeLock = async () => {
      try {
        await wakeLockRef.current?.release?.()
      } catch {
        // noop
      } finally {
        wakeLockRef.current = null
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      } else {
        releaseWakeLock()
      }
    }

    requestWakeLock()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseWakeLock()
    }
  }, [isKiosk])

  useEffect(() => {
    kioskSlideIndexRef.current = kioskSlideIndex
  }, [kioskSlideIndex])

  const startKioskSlide = (nextIndex: number) => {
    if (!protecaoTelaAtiva) return
    if (kioskSlidePaused) return
    if (kioskSlideAnimating) return
    if (nextIndex === kioskSlideIndexRef.current) return

    setKioskSlideFromIndex(kioskSlideIndexRef.current)
    setKioskSlideToIndex(nextIndex)
    setKioskSlideAnimating(true)
    setKioskSlidePhase('prep')

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setKioskSlidePhase('run')
      })
    })

    window.setTimeout(() => {
      setKioskSlideIndex(nextIndex)
      setKioskSlideAnimating(false)
      setKioskSlidePhase('idle')
    }, 720)
  }

  useEffect(() => {
    if (!isKiosk) return
    if (!protecaoTelaAtiva) {
      setKioskSlideIndex(0)
      setKioskSlideAnimating(false)
      setKioskSlidePhase('idle')
      setKioskSlidePaused(false)
      return
    }

    if (kioskSlidePaused) return

    if (slideAdvanceTimeoutRef.current) {
      window.clearTimeout(slideAdvanceTimeoutRef.current)
      slideAdvanceTimeoutRef.current = null
    }

    if (kioskSlideAnimating) return

    const currentSlide = kioskSlides[kioskSlideIndexRef.current % kioskSlides.length] as any
    const delay = Number(currentSlide?.durationMs) || KIOSK_SLIDE_INTERVAL_MS
    slideAdvanceTimeoutRef.current = window.setTimeout(() => {
      const next = (kioskSlideIndexRef.current + 1) % kioskSlides.length
      startKioskSlide(next)
    }, delay)

    return () => {
      if (slideAdvanceTimeoutRef.current) {
        window.clearTimeout(slideAdvanceTimeoutRef.current)
        slideAdvanceTimeoutRef.current = null
      }
    }
  }, [isKiosk, protecaoTelaAtiva, kioskSlides.length, kioskSlidePaused, kioskSlideAnimating, kioskSlideIndex])

  const clearLongPressTimeout = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current)
      longPressTimeoutRef.current = null
    }
  }

  const onKioskOverlayPointerDown = () => {
    longPressedRef.current = false
    clearLongPressTimeout()
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressedRef.current = true
      setKioskSlidePaused(true)
    }, 450)
  }

  const onKioskOverlayPointerUp = () => {
    const wasLongPress = longPressedRef.current
    clearLongPressTimeout()
    longPressedRef.current = false

    if (wasLongPress) {
      setKioskSlidePaused(false)
      return
    }

    setProtecaoTelaAtiva(false)
  }

  const onKioskOverlayPointerCancel = () => {
    clearLongPressTimeout()
    longPressedRef.current = false
    setKioskSlidePaused(false)
  }

  const renderKioskSlide = (slide: (typeof kioskSlides)[number]) => {
    if ((slide as any)?.variant === 'brand') {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="w-full max-w-5xl text-center">
            <div ref={brandTitleRef} className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight">
              {slide.title}
            </div>
            <div ref={brandSubtitleRef} className="mt-3 text-lg sm:text-2xl font-semibold text-white/75">
              {slide.subtitle}
            </div>

            <div className="mt-10 flex items-center justify-center">
              <div ref={brandWhatsRef} className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 backdrop-blur px-6 py-4 shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-300" />
                <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">{slide.items?.[0]}</div>
              </div>
            </div>

          </div>

          {(slide as any)?.manufacturerLogoUrl && (
            <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-10">
              <div className="flex items-center justify-end gap-3">
                <div className="text-[11px] sm:text-xs font-semibold tracking-wide text-white/60">Realização</div>
                <img
                  ref={brandLogoRef}
                  src={encodeURI((slide as any).manufacturerLogoUrl)}
                  alt="Logo do fabricante"
                  className="h-8 sm:h-9 object-contain opacity-55"
                  draggable={false}
                />
              </div>
            </div>
          )}
        </div>
      )
    }

    const Icon = (slide as any).icon as any
    return (
      <div className="w-full h-full grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-10 items-center">
        <div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
              <Icon className="w-9 h-9 sm:w-10 sm:h-10 text-sky-200" />
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">{slide.title}</div>
              <div className="mt-1 text-base sm:text-lg font-semibold text-white/75">{slide.subtitle}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-3">
            {slide.items.map((item: string, i: number) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-3xl border border-white/15 bg-white/10 backdrop-blur px-5 py-4"
              >
                <div className="mt-0.5 w-9 h-9 rounded-2xl bg-sky-300/15 border border-sky-300/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-sky-200" />
                </div>
                <div className="text-base sm:text-lg font-semibold text-white/90">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="rounded-[32px] border border-white/15 bg-white/10 backdrop-blur p-6">
            <div className="text-sm font-extrabold tracking-wide text-white/70">DESTAQUES</div>
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-white text-lg font-extrabold">Operação rápida</div>
                <div className="mt-1 text-white/70 text-sm font-semibold">Fluxo guiado e sem complicação</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-white text-lg font-extrabold">Organização total</div>
                <div className="mt-1 text-white/70 text-sm font-semibold">Bloco e apartamento sempre claros</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-white text-lg font-extrabold">Segurança</div>
                <div className="mt-1 text-white/70 text-sm font-semibold">Portas disponíveis e controle de acesso</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 🎨 PRÉ-CARREGAR VOZES PARA ÁUDIO INSTANTÂNEO
useEffect(() => {
  if ('speechSynthesis' in window) {
    // Força carregamento das vozes
    window.speechSynthesis.getVoices()
    
    // Event listener para quando as vozes carregarem
    const handleVoicesChanged = () => {
      const voices = window.speechSynthesis.getVoices()
      console.log('[TOTEM] Vozes carregadas:', voices.length)
      
      // Log vozes femininas disponíveis
      const femaleVoices = voices.filter(voice => 
        voice.lang.includes('pt-BR') && 
        (voice.name.includes('Female') || 
         voice.name.includes('Maria') || 
         voice.name.includes('Camila') ||
         voice.name.includes('Luciana') ||
         (voice as any).gender === 'female')
      )
      
      if (femaleVoices.length > 0) {
        console.log('[TOTEM] Vozes femininas disponíveis:', femaleVoices.map(v => v.name))
      }
    }
    
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged
    
    // Timeout para garantir que as vozes foram carregadas
    setTimeout(() => {
      handleVoicesChanged()
    }, 100)
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }
}, [])

// Carregar dados iniciais e configurar real-time
  useEffect(() => {
    if (condominio?.uid) {
      carregarDados()
      
      // Configurar subscription real-time para portas
      const portasChannel = supabase
        .channel('portas-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'cobrancas',
            table: 'gvt_portas'
          },
          (payload) => {
            console.log('[REAL-TIME] Mudança em gvt_portas:', payload)
            
            if (payload.eventType === 'UPDATE') {
              // Atualizar porta específica no estado
              setPortas(prev => prev.map(p => 
                p.uid === payload.new.uid 
                  ? { ...p, ...payload.new }
                  : p
              ))

              // Se a porta selecionada for a mesma, atualizar também (para refletir sensor_ima_status)
              setPortaSelecionada(prev => {
                if (!prev) return prev
                if (prev.uid !== payload.new.uid) return prev
                return { ...prev, ...payload.new } as any
              })
            } else if (payload.eventType === 'INSERT') {
              // Recarregar portas quando uma nova for inserida
              recarregarPortas()
            } else if (payload.eventType === 'DELETE') {
              // Remover porta do estado
              setPortas(prev => prev.filter(p => p.uid !== payload.old.uid))
            }
          }
        )
        .subscribe((status) => {
          console.log('[REAL-TIME] Status da subscription:', status)
        })
      
      // Cleanup ao desmontar
      return () => {
        console.log('[REAL-TIME] Removendo subscription')
        supabase.removeChannel(portasChannel)
      }
    }
  }, [condominio?.uid])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    onFullscreenChange()

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      const target = isKiosk ? document.documentElement : (fullscreenTargetRef.current ?? document.documentElement)
      await target.requestFullscreen()
    } catch (error) {
      console.error('[Totem] Erro ao alternar tela cheia:', error)
    }
  }
  
  // Função para recarregar apenas as portas (otimizada)
  const recarregarPortas = async () => {
    if (!gaveteiros.length) return
    
    // Carregar portas de todos os gaveteiros em paralelo
    const portasPromises = gaveteiros.map(gvt => 
      listarPortas(gvt.uid).then(portas => 
        portas.map(p => ({ ...p, gaveteiro: gvt }))
      )
    )
    
    const todasPortasArrays = await Promise.all(portasPromises)
    const todasPortas = todasPortasArrays.flat()
    setPortas(todasPortas)
  }

  const carregarDados = async () => {
    if (!condominio?.uid) return
    
    setLoading(true)
    try {
      // Carregar tudo em paralelo para melhor performance
      const [gaveteirosData, blocosData, apartamentosData, moradoresData] = await Promise.all([
        listarGaveteiros(condominio.uid),
        listarBlocos(condominio.uid),
        listarApartamentos(condominio.uid),
        listarMoradores(condominio.uid)
      ])
      
      setGaveteiros(gaveteirosData)
      setBlocos(blocosData)
      setApartamentos(apartamentosData)
      setMoradores(moradoresData)
      
      // Carregar portas de todos os gaveteiros em paralelo (otimização crítica)
      const portasPromises = gaveteirosData.map(gvt => 
        listarPortas(gvt.uid).then(portas => 
          portas.map(p => ({ ...p, gaveteiro: gvt }))
        )
      )
      
      const todasPortasArrays = await Promise.all(portasPromises)
      const todasPortas = todasPortasArrays.flat()
      setPortas(todasPortas)
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const portasDisponiveis = portas.filter(p => p.status_atual === 'DISPONIVEL' && !(p as any).reservada_portaria)
  const portasDisponiveisTotalPages = Math.max(1, Math.ceil(portasDisponiveis.length / portaPageSize))
  const portasDisponiveisPaginadas = portasDisponiveis.slice(
    (portaPage - 1) * portaPageSize,
    portaPage * portaPageSize
  )

  useEffect(() => {
    if (etapa !== 'selecionar_porta') return
    setPortaPage(1)
  }, [etapa, portaPageSize])

  useEffect(() => {
    if (etapa !== 'selecionar_porta') return
    setPortaPage(prev => Math.min(prev, portasDisponiveisTotalPages))
  }, [etapa, portasDisponiveisTotalPages])

  const portaSelecionadaAtualizada = portaSelecionada
    ? (portas.find(p => p.uid === portaSelecionada.uid) ?? portaSelecionada)
    : null

  const sensorImaStatus = (portaSelecionadaAtualizada as any)?.sensor_ima_status as string | undefined

  const sensorImaStatusNormalizado = (sensorImaStatus || '').toLowerCase()
  const portaSensorAberta = sensorImaStatusNormalizado === 'aberto'
  const portaSensorFechada = sensorImaStatusNormalizado === 'fechado'
  const portaSensorAbrindo = !portaSensorAberta && !portaSensorFechada

  const kioskTelaSucesso = isKiosk && etapa === 'sucesso'

  const comprovantePayload = {
    tipo: 'COMPROVANTE_TOTEM',
    condominio_uid: condominio?.uid || null,
    porta: portaSelecionadaAtualizada?.numero_porta || null,
    criado_em: new Date().toISOString(),
    finalizado_em: finalizadoEm ? new Date(finalizadoEm).toISOString() : null,
    total_destinos: destinatarios.length,
    total_encomendas: destinatarios.reduce((sum, d) => sum + (d.quantidade || 0), 0),
    destinatarios,
    senhas: senhasGeradas
  }

  const encodeBase64Utf8 = (input: string) => {
    const bytes = new TextEncoder().encode(input)
    let binary = ''
    bytes.forEach(b => {
      binary += String.fromCharCode(b)
    })
    return btoa(binary)
  }

  const comprovanteTotemJson = JSON.stringify(comprovantePayload)
  const comprovanteEncoded = encodeURIComponent(encodeBase64Utf8(comprovanteTotemJson))
  const comprovantePath = `/comprovante?d=${comprovanteEncoded}`
  const comprovanteUrl = typeof window === 'undefined' ? comprovantePath : `${window.location.origin}${comprovantePath}`

  const copiarComprovanteTotem = async () => {
    try {
      await navigator.clipboard.writeText(comprovanteUrl)
      setCopiadoComprovante(true)
      window.setTimeout(() => setCopiadoComprovante(false), 1800)
    } catch (error) {
      console.warn('[TOTEM] Falha ao copiar comprovante:', error)
    }
  }

  const normalizarWhatsappEntregador = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55')) return digits
    return `55${digits}`
  }

  const formatarTelefone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const handleWhatsappChange = (value: string) => {
    const formatted = formatarTelefone(value)
    setWhatsappEntregador(formatted)
    setWhatsappEntregadorEnviado(false)
    setWhatsappEntregadorErro('')
  }

  useEffect(() => {
    const digits = whatsappEntregador.replace(/\D/g, '')
    if (digits.length === 11 && !enviandoWhatsappEntregador && !whatsappEntregadorEnviado) {
      void enviarWhatsappEntregador()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappEntregador])

  const enviarWhatsappEntregador = async () => {
    if (enviandoWhatsappEntregador) return
    setWhatsappEntregadorErro('')
    setWhatsappEntregadorEnviado(false)

    const whatsapp = normalizarWhatsappEntregador(whatsappEntregador)
    if (whatsapp.length < 12) {
      setWhatsappEntregadorErro('Informe um WhatsApp válido com DDD')
      return
    }

    setEnviandoWhatsappEntregador(true)
    try {
      const response = await fetch('/api/totem/notificar-entregador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp,
          comprovanteUrl,
          comprovantePayload,
          condominioUid: condominio?.uid || null,
          numeroPorta: portaSelecionadaAtualizada?.numero_porta || null
        })
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        setWhatsappEntregadorErro(data?.error || 'Não foi possível enviar a notificação')
        return
      }

      setWhatsappEntregadorEnviado(true)
    } catch (error) {
      setWhatsappEntregadorErro(error instanceof Error ? error.message : 'Não foi possível enviar a notificação')
    } finally {
      setEnviandoWhatsappEntregador(false)
    }
  }

  const cancelarOperacaoTotem = async (motivo: string) => {
    if (!condominio?.uid) return
    if (portaSensorFechada) return
    if (!portaSelecionadaAtualizada?.numero_porta) {
      reiniciar()
      return
    }

    if (sensorPollingRef.current) {
      clearInterval(sensorPollingRef.current)
      sensorPollingRef.current = null
    }

    setCancelandoOperacao(true)
    try {
      const response = await fetch('/api/totem/cancelar-porta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condominioUid: condominio.uid,
          numeroPorta: portaSelecionadaAtualizada.numero_porta,
          motivo
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        console.error('[TOTEM] Falha ao cancelar porta:', data)
      }
    } catch (error) {
      console.error('[TOTEM] Erro ao cancelar operação:', error)
    } finally {
      setCancelandoOperacao(false)
      reiniciar()
    }
  }

  const confirmarFechamentoManual = async () => {
    if (!condominio?.uid) return
    if (etapa !== 'sucesso') return
    if (!portaSelecionadaAtualizada?.numero_porta) return
    if (portaSensorFechada) return
    if (cancelandoOperacao || confirmandoFechamento) return

    setMensagemConfirmarFechamento('')
    setConfirmandoFechamento(true)

    try {
      const TIMEOUT_MS = 8_000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
      console.log('[TOTEM] confirmarFechamentoManual -> request', {
        condominioUid: condominio.uid,
        numeroPorta: portaSelecionadaAtualizada.numero_porta
      })

      let response: Response
      try {
        response = await fetch('/api/totem/confirmar-fechamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            condominioUid: condominio.uid,
            numeroPorta: portaSelecionadaAtualizada.numero_porta
          }),
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeoutId)
      }

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        setMensagemConfirmarFechamento(data?.error || 'Não foi possível confirmar o fechamento')
        return
      }

      ;(() => {
        const SENSOR_TIMEOUT_MS = 4_000
        const sensorController = new AbortController()
        const sensorTimeoutId = setTimeout(() => sensorController.abort(), SENSOR_TIMEOUT_MS)
        fetch('/api/totem/sensor-porta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            condominioUid: condominio.uid,
            numeroPorta: portaSelecionadaAtualizada.numero_porta
          }),
          signal: sensorController.signal
        })
          .then(() => null)
          .catch(() => null)
          .finally(() => clearTimeout(sensorTimeoutId))
      })()
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setMensagemConfirmarFechamento('Tempo esgotado ao confirmar. Verifique a conexão e tente novamente.')
        return
      }
      setMensagemConfirmarFechamento(error?.message || 'Não foi possível confirmar o fechamento')
    } finally {
      setConfirmandoFechamento(false)
    }
  }

  useEffect(() => {
    if (sensorPollingRef.current) {
      clearInterval(sensorPollingRef.current)
      sensorPollingRef.current = null
    }

    if (!condominio?.uid) return
    if (etapa !== 'sucesso') return
    if (!portaSelecionadaAtualizada?.numero_porta) return
    if (portaSensorFechada) return
    if (cancelandoOperacao) return

    const consultar = async () => {
      try {
        await fetch('/api/totem/sensor-porta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            condominioUid: condominio.uid,
            numeroPorta: portaSelecionadaAtualizada.numero_porta
          })
        })
      } catch (error) {
        console.warn('[TOTEM] Erro ao consultar sensor:', error)
      }
    }

    consultar()
    sensorPollingRef.current = setInterval(consultar, 1000)

    return () => {
      if (sensorPollingRef.current) {
        clearInterval(sensorPollingRef.current)
        sensorPollingRef.current = null
      }
    }
  }, [condominio?.uid, etapa, portaSelecionadaAtualizada?.numero_porta, portaSensorFechada, cancelandoOperacao])

  useEffect(() => {
    if (etapa !== 'sucesso') {
      setDepositoDeadline(null)
      setDepositoRestanteMs(0)
      return
    }
    if (!portaSelecionadaAtualizada?.numero_porta) return
    if (portaSensorFechada) {
      setDepositoDeadline(null)
      setDepositoRestanteMs(0)
      return
    }
    if (cancelandoOperacao) return

    const DEPOSITO_TIMEOUT_MS = 90_000
    const deadline = Date.now() + DEPOSITO_TIMEOUT_MS
    autoConfirmacaoDepositoRef.current = false
    setDepositoDeadline(deadline)
    setDepositoRestanteMs(DEPOSITO_TIMEOUT_MS)
  }, [etapa, portaSelecionadaAtualizada?.numero_porta, portaSensorFechada, cancelandoOperacao])

  useEffect(() => {
    if (!depositoDeadline) return
    if (portaSensorFechada) return
    if (cancelandoOperacao) return

    const tick = () => {
      const restante = Math.max(0, depositoDeadline - Date.now())
      setDepositoRestanteMs(restante)

      if (restante <= 0) {
        if (autoConfirmacaoDepositoRef.current) return
        autoConfirmacaoDepositoRef.current = true
        void confirmarFechamentoManual().catch(() => {})
      }
    }

    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [depositoDeadline, portaSensorFechada, cancelandoOperacao])

  const formatarTempo = (ms: number) => {
    const total = Math.ceil(ms / 1000)
    const min = Math.floor(total / 60)
    const seg = total % 60
    return `${String(min)}:${String(seg).padStart(2, '0')}`
  }

  const headerSubtitle = (() => {
    if (etapa === 'selecionar_bloco') return 'Escolha o bloco de destino'
    if (etapa === 'selecionar_apartamento') {
      if (!blocoSelecionado) return 'Selecione um apartamento'
      const nomeBloco = blocoSelecionado.trim()
      const jaTemPrefixo = nomeBloco.toLowerCase().startsWith('bloco')
      return `${jaTemPrefixo ? nomeBloco : `Bloco ${nomeBloco}`}`
    }
    if (etapa === 'selecionar_porta') return 'Selecione a porta para depositar a encomenda'
    if (etapa === 'confirmando') return 'Confirmando ocupação...'
    if (etapa === 'sucesso') return 'Concluído'
    if (etapa === 'erro') return 'Não foi possível concluir'
    return ''
  })()

  useEffect(() => {
    if (etapa !== 'sucesso' || !portaSensorFechada) {
      setAutoFinalizarEm(null)
      return
    }

    setAutoFinalizarEm(30)

    const interval = setInterval(() => {
      setAutoFinalizarEm(prev => {
        if (prev === null) return prev
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [etapa, portaSensorFechada])

  useEffect(() => {
    if (autoFinalizarEm === 0) {
      reiniciar()
    }
  }, [autoFinalizarEm])

  useEffect(() => {
    if (etapa !== 'sucesso' || !portaSensorFechada) {
      setFinalizadoEm(null)
      return
    }
    setFinalizadoEm(prev => (prev ? prev : Date.now()))
  }, [etapa, portaSensorFechada])

  const blocosFiltrados = blocos.filter(b => 
    b.nome.toLowerCase().includes(buscaBloco.toLowerCase())
  )

  const totalEncomendas = destinatarios.reduce((sum, d) => sum + (d.quantidade || 0), 0)
  const podeIrParaApto = Boolean(blocoSelecionado) || destinatarios.length > 0
  const podeIrParaPorta = destinatarios.length > 0
  const blocosNoCarrinho = new Set(destinatarios.map(d => d.bloco))

  const apartamentosFiltrados = apartamentos
    .filter(a => a.bloco_uid === blocos.find(b => b.nome === blocoSelecionado)?.uid)
    .filter(a => a.numero.toLowerCase().includes(buscaApto.toLowerCase()))

  const selecionarBloco = (nome: string) => {
    setBlocoSelecionado(nome)
    setDestinoAtivo({ bloco: nome, apartamento: '' })
    setBuscaApto('')
    setEtapa('selecionar_apartamento')
  }

  // Selecionar apartamento (primeira vez define quantidade=1; ajustes via +/−)
  const adicionarDestinatario = (apartamento: string) => {
    setDestinatarios(prev => {
      const idx = prev.findIndex(d => d.bloco === blocoSelecionado && d.apartamento === apartamento)
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      return [...prev, { bloco: blocoSelecionado, apartamento, quantidade: 1 }]
    })
  }

  const removerDestinatarioCompleto = (bloco: string, apartamento: string) => {
    setDestinatarios(prev => prev.filter(d => !(d.bloco === bloco && d.apartamento === apartamento)))
  }

  const incrementarDestinatario = (bloco: string, apartamento: string) => {
    setDestinatarios(prev => {
      const idx = prev.findIndex(d => d.bloco === bloco && d.apartamento === apartamento)
      if (idx < 0) return [...prev, { bloco, apartamento, quantidade: 1 }]
      const next = [...prev]
      next[idx] = { ...next[idx], quantidade: (next[idx].quantidade || 0) + 1 }
      return next
    })
  }

  const decrementarDestinatario = (bloco: string, apartamento: string) => {
    setDestinatarios(prev => {
      const idx = prev.findIndex(d => d.bloco === bloco && d.apartamento === apartamento)
      if (idx < 0) return prev
      const item = prev[idx]
      const qtd = item.quantidade || 0
      if (qtd <= 1) return prev.filter((_, i) => i !== idx)
      const next = [...prev]
      next[idx] = { ...item, quantidade: qtd - 1 }
      return next
    })
  }

  const promiseWithTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
  
  // Voltar para seleção de blocos (outro bloco)
  const voltarParaBlocos = () => {
    setBlocoSelecionado('')
    setBuscaBloco('')
    setEtapa('selecionar_bloco')
  }

  // Remover destinatário da lista
  const removerDestinatario = (index: number) => {
    setDestinatarios(prev => {
      const item = prev[index]
      if (!item) return prev
      if ((item.quantidade || 0) > 1) {
        const next = [...prev]
        next[index] = { ...item, quantidade: item.quantidade - 1 }
        return next
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const removerBlocoDoCarrinho = (bloco: string) => {
    setDestinatarios(prev => {
      const next = prev.filter(d => d.bloco !== bloco)

      if (next.length === 0) {
        setEtapa('selecionar_bloco')
        setBlocoSelecionado('')
        setPortaSelecionada(null)
      } else if (blocoSelecionado === bloco) {
        setBlocoSelecionado('')
        setEtapa('selecionar_bloco')
      }

      return next
    })
  }

  const toggleCarrinhoBloco = (bloco: string) => {
    setBlocosCarrinhoExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(bloco)) {
        next.delete(bloco)
      } else {
        next.add(bloco)
      }
      return next
    })
  }

  // Ir para seleção de porta
  const irParaSelecaoPorta = () => {
    if (destinatarios.length === 0) return
    setEtapa('selecionar_porta')
  }

  const selecionarPorta = (porta: Porta) => {
    setPortaSelecionada(porta)
  }

  const obterDestinoParaConfirmacao = () => {
    const destinoAtivoValido = destinoAtivo?.bloco && destinoAtivo?.apartamento
      ? destinoAtivo
      : null

    if (destinoAtivoValido) {
      return { bloco: destinoAtivoValido.bloco, apartamento: destinoAtivoValido.apartamento }
    }

    const primeiro = destinatarios[0]
    if (!primeiro?.bloco || !primeiro?.apartamento) return null
    return { bloco: primeiro.bloco, apartamento: primeiro.apartamento }
  }

  const abrirConfirmacaoPorta = (porta: Porta) => {
    setPortaEmConfirmacao(porta)
    setMostrarConfirmacaoPorta(true)
  }

  const prosseguirConfirmacaoPorta = () => {
    if (!portaEmConfirmacao) return
    setMostrarConfirmacaoPorta(false)
    setPortaSelecionada(portaEmConfirmacao)
    void confirmarOcupacao(portaEmConfirmacao).catch(() => {})
    setPortaEmConfirmacao(null)
  }

  const verificarConfirmacaoPorta = () => {
    const destino = obterDestinoParaConfirmacao()
    setMostrarConfirmacaoPorta(false)
    setPortaEmConfirmacao(null)
    if (!destino?.bloco) {
      setEtapa('selecionar_bloco')
      return
    }
    setBlocoSelecionado(destino.bloco)
    setDestinoAtivo({ bloco: destino.bloco, apartamento: destino.apartamento || '' })
    setBuscaApto('')
    setEtapa('selecionar_apartamento')
  }

  const confirmarOcupacao = async (portaOverride?: Porta) => {
    const porta = portaOverride ?? portaSelecionada
    if (!porta || !condominio?.uid || destinatarios.length === 0) return
    
    setProcessando(true)
    setEtapa('confirmando')
    
    // Logs de debug para tablet
    console.log('[TOTEM DEBUG] Iniciando confirmarOcupacao')
    console.log('[TOTEM DEBUG] portaSelecionada:', porta)
    console.log('[TOTEM DEBUG] condominio?.uid:', condominio?.uid)
    console.log('[TOTEM DEBUG] destinatarios:', destinatarios)
    console.log('[TOTEM DEBUG] User Agent:', navigator.userAgent)
    console.log('[TOTEM DEBUG] Platform:', navigator.platform)
    console.log('[TOTEM DEBUG] Speech Synthesis disponível:', 'speechSynthesis' in window)
    
    try {
      const OCUPAR_TIMEOUT_MS = 20_000
      const ABRIR_TIMEOUT_MS = 20_000

      // Enviar destinatários agregados (com quantidade) para persistir no banco.
      // A expansão por quantidade para gerar senhas/itens é feita no backend (ocuparPorta).
      const listaDestinatarios: Destinatario[] = destinatarios.map(d => ({
        bloco: d.bloco,
        apartamento: d.apartamento,
        quantidade: Math.max(1, d.quantidade || 1)
      }))

      // Ocupar porta com múltiplos destinatários
      const tOcuparIni = performance.now()
      const resultado = await promiseWithTimeout(
        ocuparPortaViaApi({
          portaUid: porta.uid,
          condominioUid: condominio.uid,
          destinatarios: listaDestinatarios,
          usuarioUid: usuario?.uid,
          observacao: `Ocupação via Totem - ${totalEncomendas} encomenda(s)`
        }),
        OCUPAR_TIMEOUT_MS,
        'Tempo esgotado ao confirmar ocupação. Tente novamente.'
      )
      console.log('[TOTEM] ocuparPortaViaApi duração(ms):', Math.round(performance.now() - tOcuparIni))

      if (!(resultado as any)?.sucesso) {
        setMensagemErro((resultado as any)?.error || 'Não foi possível registrar a encomenda.')
        setEtapa('erro')
        return
      }

      console.log('[TOTEM] Porta ocupada no banco, preparando para abrir fisicamente...')

      // Abrir porta física com token SHA256 (método que funciona)
      const gaveteiro = (porta as any).gaveteiro
      console.log('[TOTEM DEBUG] gaveteiro:', gaveteiro)
      console.log('[TOTEM DEBUG] gaveteiro.codigo_hardware:', gaveteiro?.codigo_hardware)
      
      if (gaveteiro?.codigo_hardware) {
        console.log('[TOTEM] Iniciando abertura física da porta...')
        
        try {
          const controller = new AbortController()
          const abortTimeout = setTimeout(() => controller.abort(), ABRIR_TIMEOUT_MS)
          const tAbrirIni = performance.now()

          let response: Response
          try {
            response = await fetch('/api/proxy/abrir-porta-individual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                condominioUid: condominio.uid,
                portaUid: porta.uid,
                porta: porta.numero_porta
              }),
              signal: controller.signal
            })
          } finally {
            clearTimeout(abortTimeout)
          }

          console.log('[TOTEM] abrir-porta-individual duração(ms):', Math.round(performance.now() - tAbrirIni))

          const data = await response.json().catch(() => null)

          if (!response.ok || !data?.success) {
            console.warn('[TOTEM] Falha ao abrir porta via proxy:', data)
          } else {
            console.log('[TOTEM] Porta aberta com sucesso (proxy)!')

            await atualizarSensorImaPorNumero(
              porta.gaveteiro_uid,
              porta.numero_porta,
              'aberto'
            ).catch((error) => {
              console.warn('[TOTEM] Falha ao marcar sensor como aberto:', error)
            })

            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(
                `Porta ${porta.numero_porta} está aberta. Deposite sua mercadoria.`
              )
              utterance.lang = 'pt-BR'
              utterance.rate = 1.8
              utterance.pitch = 1.2
              utterance.volume = 1.0

              const voices = window.speechSynthesis.getVoices()
              const femaleVoice = voices.find(voice =>
                voice.lang.includes('pt-BR') &&
                (voice.name.includes('Female') ||
                  voice.name.includes('Maria') ||
                  voice.name.includes('Camila') ||
                  voice.name.includes('Luciana') ||
                  (voice as any).gender === 'female')
              )

              if (femaleVoice) {
                utterance.voice = femaleVoice
              } else {
                const brazilianVoice = voices.find(voice => voice.lang.includes('pt-BR'))
                if (brazilianVoice) utterance.voice = brazilianVoice
              }

              window.speechSynthesis.cancel()
              window.speechSynthesis.speak(utterance)
            }
          }
          
        } catch (espError: any) {
          const abortMsg = espError?.name === 'AbortError'
            ? 'Tempo esgotado ao tentar abrir a porta. Verifique a conexão e tente novamente.'
            : espError?.message

          console.error('[TOTEM] Erro ao abrir porta:', abortMsg)
          console.error('[TOTEM] Stack:', espError?.stack)

          if (espError?.name === 'AbortError') {
            throw new Error('Tempo esgotado ao tentar abrir a porta. Tente novamente.')
          }
        }
      } else {
        console.warn('[TOTEM] Porta não possui gaveteiro.codigo_hardware')
        console.log('[TOTEM] portaSelecionada:', porta)
      }

      setSenhasGeradas((resultado as any).senhas)
      setEtapa('sucesso')
      
    } catch (error: any) {
      console.error('Erro ao ocupar porta:', error)
      setMensagemErro(error.message || 'Erro ao ocupar porta')
      setEtapa('erro')
    } finally {
      setProcessando(false)
    }
  }

  const reiniciar = () => {
    setBlocoSelecionado('')
    setDestinatarios([])
    setPortaSelecionada(null)
    setSenhasGeradas([])
    setMensagemErro('')
    setBuscaBloco('')
    setBuscaApto('')
    setWhatsappEntregador('')
    setWhatsappEntregadorEnviado(false)
    setWhatsappEntregadorErro('')
    setEtapa(isKiosk ? 'inicio' : 'selecionar_bloco')
    carregarDados()
  }

  const copiarSenha = (senha: string) => {
    navigator.clipboard.writeText(senha)
  }

  if (loading) {
    return (
      <div
        className={`${embeddedBleedClass} ${isKiosk ? 'h-screen' : 'h-[60vh]'} w-full flex items-center justify-center overflow-x-hidden ${
          isFullscreen || isKiosk ? 'bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900' : 'bg-slate-50'
        }`}
      >
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-sky-600 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">Carregando...</p>
        </div>
      </div>
    )
  }

  if (etapa === 'confirmando') {
    return (
      <div
        ref={fullscreenTargetRef}
        data-etapa={etapa}
        className={`${embeddedBleedClass} h-screen p-0 flex items-center justify-center overflow-x-hidden bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900`}
      >
        <div className="w-full max-w-xl mx-6 bg-white/95 border border-white/20 rounded-3xl shadow-2xl p-10 text-center">
          <div className="text-xs font-extrabold tracking-[0.24em] text-slate-500">PROCESSANDO</div>
          <h2 className="mt-4 text-3xl font-extrabold text-slate-950">Abrindo a porta do gaveteiro</h2>
          <p className="mt-2 text-lg font-semibold text-slate-600">Aguarde destravar para depositar.</p>
          <div className="mt-8 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-sky-600" />
          </div>
        </div>
      </div>
    )
  }

  if (kioskTelaSucesso) {
    return (
      <div
        ref={fullscreenTargetRef}
        data-etapa={etapa}
        className={`${embeddedBleedClass} h-screen p-0 flex flex-col overflow-x-hidden bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900`}
      >
        {isKiosk && protecaoTelaAtiva && (
          <div
            className="fixed inset-0 z-[100] text-white bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900"
            onPointerDown={onKioskOverlayPointerDown}
            onPointerUp={onKioskOverlayPointerUp}
            onPointerCancel={onKioskOverlayPointerCancel}
            onPointerLeave={onKioskOverlayPointerCancel}
            role="button"
            aria-label="Toque para voltar"
          >
            {(KIOSK_SCREENSAVER_VIDEO_URL || KIOSK_SCREENSAVER_IMAGE_URL) && (
              <div className="absolute inset-0">
                {KIOSK_SCREENSAVER_VIDEO_URL ? (
                  <video
                    className="h-full w-full object-cover"
                    src={KIOSK_SCREENSAVER_VIDEO_URL}
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    className="h-full w-full object-cover"
                    src={KIOSK_SCREENSAVER_IMAGE_URL}
                    alt=""
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-950/85 via-indigo-950/75 to-sky-900/85" />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div className={`w-full transition-all ${portaSensorFechada ? 'max-w-lg' : 'max-w-5xl'}`}>
            <div className={`rounded-[32px] border shadow-xl overflow-hidden bg-gradient-to-br ${
              portaSensorFechada
                ? 'from-emerald-50 via-white to-white border-emerald-100'
                : portaSensorAberta
                  ? 'from-amber-50 via-white to-white border-amber-100'
                  : 'from-sky-50 via-white to-white border-sky-100'
            }`}>
              {portaSensorFechada ? (
                <div className="px-8 py-8 flex flex-col items-center">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-600 text-white flex items-center justify-center shadow-lg">
                      <span className="text-3xl font-extrabold leading-none">{portaSelecionadaAtualizada?.numero_porta}</span>
                    </div>
                    <div>
                      <div className="text-xs font-extrabold tracking-[0.2em] text-emerald-600 uppercase">Sucesso</div>
                      <div className="text-xl font-extrabold tracking-tight text-slate-900">Entrega confirmada</div>
                    </div>
                  </div>

                  {/* Comprovante + WhatsApp */}
                  <div className="w-full mt-6 space-y-4">
                    {/* QR row */}
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="shrink-0 rounded-xl bg-white p-1.5 border border-slate-100">
                        <QRCode value={comprovanteUrl} size={72} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800">Comprovante</div>
                        <button
                          type="button"
                          onClick={copiarComprovanteTotem}
                          className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                            copiadoComprovante ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {copiadoComprovante ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiadoComprovante ? 'Copiado!' : 'Copiar link'}
                        </button>
                      </div>
                    </div>

                    {/* WhatsApp — destaque */}
                    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                          <Phone className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-emerald-900">Notificar entregador</div>
                          <div className="text-[11px] text-emerald-700/70">Informe o WhatsApp para enviar o comprovante</div>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          value={whatsappEntregador}
                          onChange={e => handleWhatsappChange(e.target.value)}
                          inputMode="tel"
                          placeholder="(00) 00000-0000"
                          disabled={whatsappEntregadorEnviado}
                          className={`h-12 w-full rounded-xl border px-4 text-base font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all ${
                            whatsappEntregadorErro
                              ? 'border-rose-300 bg-rose-50/60 focus:ring-rose-200 text-rose-900'
                              : whatsappEntregadorEnviado
                                ? 'border-emerald-300 bg-white text-emerald-800'
                                : 'border-emerald-200 bg-white focus:ring-emerald-300'
                          }`}
                        />
                        {enviandoWhatsappEntregador ? (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                          </div>
                        ) : whatsappEntregadorEnviado ? (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </div>
                        ) : null}
                      </div>
                      {whatsappEntregadorErro ? (
                        <div className="mt-2 text-xs font-semibold text-rose-600">{whatsappEntregadorErro}</div>
                      ) : whatsappEntregadorEnviado ? (
                        <div className="mt-2 text-xs font-semibold text-emerald-700">Notificação enviada com sucesso.</div>
                      ) : (
                        <div className="mt-2 text-[11px] text-emerald-600/60">Envio automático ao completar o número.</div>
                      )}
                    </div>

                    {/* Finalizar */}
                    <button
                      type="button"
                      onClick={reiniciar}
                      className="w-full h-14 rounded-2xl font-extrabold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg hover:from-emerald-700 hover:to-green-700 text-lg"
                    >
                      <Package className="w-5 h-5" />
                      Finalizar
                    </button>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-12 min-h-[380px]">
                <div className="col-span-12 lg:col-span-7 p-6 flex flex-col">
                      <div className="flex items-start justify-between gap-6">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold tracking-[0.18em] text-slate-400">OPERAÇÃO DO TOTEM</div>
                          <div className="mt-2 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center shadow-lg">
                              <span className="text-3xl font-extrabold leading-none">{portaSelecionadaAtualizada?.numero_porta}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-lg font-extrabold tracking-tight text-slate-900">Porta selecionada</div>
                              <div className="text-sm font-semibold text-slate-500">Depósito em andamento</div>
                            </div>
                          </div>
                        </div>

                        <div className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-extrabold uppercase tracking-wide border ${
                          portaSensorAberta
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-sky-50 text-sky-800 border-sky-200'
                        }`}>
                          {portaSensorAberta ? 'Porta aberta' : 'Aguardando sensor'}
                        </div>
                      </div>

                      <div className="mt-5 rounded-3xl border border-slate-200 bg-white/80 shadow-sm p-6">
                        <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                          Deposite a mercadoria no gaveteiro
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-600">
                          Após depositar, feche a porta. O sensor confirmará automaticamente.
                        </div>

                        {portaSensorAberta ? (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <div className="text-xs font-extrabold tracking-wide text-amber-900">AGUARDANDO FECHAMENTO</div>
                            <div className="mt-1 text-sm font-semibold text-amber-900/90">Aguardando o sensor confirmar o fechamento…</div>
                          </div>
                        ) : null}
                      </div>

                  <div className="mt-6">
                    {mensagemConfirmarFechamento ? (
                      <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                        {mensagemConfirmarFechamento}
                      </div>
                    ) : null}

                      <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3">
                          <button
                            type="button"
                            onClick={confirmarFechamentoManual}
                            disabled={cancelandoOperacao || confirmandoFechamento}
                            className="relative h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-extrabold flex items-center justify-center shadow-lg hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-50 overflow-hidden"
                          >
                            {depositoDeadline && !confirmandoFechamento ? (
                              <div
                                className="absolute bottom-0 left-0 h-1 bg-white/35"
                                style={{ width: `${Math.min(100, Math.max(0, (depositoRestanteMs / 90000) * 100))}%` }}
                              />
                            ) : null}
                            <span className="w-full px-4 inline-flex items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                <CheckCircle2 className={`w-5 h-5 ${confirmandoFechamento ? 'animate-pulse' : ''}`} />
                                {confirmandoFechamento ? 'Confirmando...' : 'Confirmar entrega'}
                              </span>
                              {depositoDeadline && !confirmandoFechamento ? (
                                <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-white/15 text-white text-sm font-extrabold tabular-nums whitespace-nowrap">
                                  {formatarTempo(depositoRestanteMs)}
                                </span>
                              ) : null}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => cancelarOperacaoTotem('Cancelamento pelo entregador (Totem)')}
                            disabled={cancelandoOperacao || confirmandoFechamento}
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-5 h-5" />
                            <span className="whitespace-nowrap">Cancelar</span>
                          </button>
                        </div>
                      </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-5 bg-gradient-to-b from-slate-50 to-white border-t lg:border-t-0 lg:border-l border-slate-200 p-7 flex flex-col">
                    <div className="flex-1 flex flex-col">
                      <div className="flex-1 rounded-3xl border border-slate-200 bg-white shadow-sm flex items-center justify-center p-6">
                        <img
                          src="/3_delivery%20(1).gif"
                          alt=""
                          className="w-[360px] max-w-full h-auto max-h-[240px] object-contain"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={fullscreenTargetRef}
      data-etapa={etapa}
      className={`${embeddedBleedClass} h-screen ${isKiosk ? (etapa === 'inicio' || etapa === 'sucesso' ? 'p-0' : 'p-4') : 'p-4'} flex flex-col overflow-x-hidden ${
        isFullscreen || isKiosk ? 'bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900' : 'bg-slate-50'
      }`}
    >
      {mostrarConfirmacaoPorta && portaEmConfirmacao && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => {
              setMostrarConfirmacaoPorta(false)
              setPortaEmConfirmacao(null)
            }}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">Confirmar destino</div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">Confira o carrinho</div>
                </div>

                <div className="shrink-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] font-extrabold tracking-[0.18em] text-slate-500">PORTA</div>
                    <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-extrabold tabular-nums">
                      {portaEmConfirmacao.numero_porta}
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const itens = destinatarios
                  .map(d => ({
                    bloco: String(d.bloco || ''),
                    apartamento: String(d.apartamento || ''),
                    quantidade: Math.max(1, Number(d.quantidade || 1))
                  }))
                  .filter(i => i.bloco && i.apartamento)
                  .sort((a, b) => {
                    const byBloco = a.bloco.localeCompare(b.bloco, undefined, { numeric: true })
                    if (byBloco !== 0) return byBloco
                    return a.apartamento.localeCompare(b.apartamento, undefined, { numeric: true })
                  })

                const totalItens = itens.reduce((sum, i) => sum + (i.quantidade || 0), 0)

                return (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-900">Carrinho</div>
                      <div className="text-sm font-semibold text-slate-600 tabular-nums">{totalItens} item(ns)</div>
                    </div>

                    <div className="px-4 py-3">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-[11px] font-extrabold tracking-[0.18em] text-slate-400">
                        <div>BLOCO</div>
                        <div>APTO</div>
                        <div className="text-right">QTD</div>
                      </div>

                      <div className="mt-2 grid gap-2 max-h-[240px] overflow-y-auto pr-1">
                        {itens.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                            Carrinho vazio.
                          </div>
                        ) : (
                          itens.map((i, idx) => (
                            <div
                              key={`${i.bloco}::${i.apartamento}::${idx}`}
                              className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <div className="text-base font-extrabold text-slate-900 tabular-nums">{i.bloco}</div>
                              <div className="text-base font-extrabold text-slate-900 tabular-nums">{i.apartamento}</div>
                              <div className="text-base font-extrabold text-slate-900 tabular-nums text-right">{i.quantidade}</div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-4 text-sm font-semibold text-slate-700">Está correto?</div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">Toque em Verificar para corrigir bloco/apartamento.</div>
                    </div>
                  </div>
                )
              })()}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={verificarConfirmacaoPorta}
                  className="h-12 rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold hover:bg-slate-50 transition-colors"
                >
                  Verificar
                </button>
                <button
                  type="button"
                  onClick={prosseguirConfirmacaoPorta}
                  className="h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-extrabold hover:from-emerald-700 hover:to-green-700 transition-all"
                >
                  Prosseguir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isKiosk && protecaoTelaAtiva && (
        <div
          className="fixed inset-0 z-[100] text-white bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900"
          onPointerDown={onKioskOverlayPointerDown}
          onPointerUp={onKioskOverlayPointerUp}
          onPointerCancel={onKioskOverlayPointerCancel}
          onPointerLeave={onKioskOverlayPointerCancel}
          role="button"
          aria-label="Toque para voltar"
        >
          {(KIOSK_SCREENSAVER_VIDEO_URL || KIOSK_SCREENSAVER_IMAGE_URL) && (
            <div className="absolute inset-0">
              {KIOSK_SCREENSAVER_VIDEO_URL ? (
                <video
                  className="h-full w-full object-cover"
                  src={KIOSK_SCREENSAVER_VIDEO_URL}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  className="h-full w-full object-cover"
                  src={KIOSK_SCREENSAVER_IMAGE_URL}
                  alt=""
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-950/85 via-indigo-950/75 to-sky-900/85" />
            </div>
          )}
          <div className="relative h-full w-full p-8 sm:p-10">
            <div className="h-full w-full max-w-6xl mx-auto flex flex-col">
              {kioskSlidePaused && (
                <div className="absolute top-6 right-6 sm:top-8 sm:right-10">
                  <div className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-white/20 bg-white/10 backdrop-blur text-white text-xs sm:text-sm font-extrabold tracking-wide shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-sky-300" />
                    PAUSADO
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md overflow-hidden p-1">
                        <svg viewBox="0 0 36 26" className="w-full h-full">
                          <rect x="1" y="1" width="16" height="11" rx="2" fill="#22c55e" />
                          <rect x="19" y="1" width="16" height="11" rx="2" fill="#ef4444" />
                          <rect x="1" y="14" width="16" height="11" rx="2" fill="#ef4444" />
                          <rect x="19" y="14" width="16" height="11" rx="2" fill="#22c55e" />
                          <text x="9" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                            1
                          </text>
                          <text x="27" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                            2
                          </text>
                          <text x="9" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                            3
                          </text>
                          <text x="27" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                            4
                          </text>
                        </svg>
                      </div>
                      <svg viewBox="0 0 28 44" className="w-4 h-7 -ml-2">
                        <ellipse cx="14" cy="30" rx="10" ry="12" fill="white" />
                        <circle cx="14" cy="12" r="10" fill="#fcd34d" />
                        <circle cx="11" cy="11" r="1.5" fill="#1e293b" />
                        <circle cx="17" cy="11" r="1.5" fill="#1e293b" />
                        <path d="M10 15 Q14 19 18 15" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                        <path d="M6 9 Q10 3 22 9" fill="#92400e" />
                        <rect x="2" y="34" width="11" height="9" rx="2" fill="#f59e0b" />
                        <line x1="7.5" y1="34" x2="7.5" y2="43" stroke="#b45309" strokeWidth="1.5" />
                        <circle cx="7.5" cy="34" r="2.5" fill="#dc2626" />
                      </svg>
                    </div>

                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">AIRE</div>
                  </div>

                  <div className="mt-0.5 text-white/70 text-sm sm:text-base font-semibold">
                    Armário inteligente de recebimento e entrega
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  {kioskSlides.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-2 rounded-full transition-all ${idx === (kioskSlideIndex % kioskSlides.length) ? 'w-10 bg-sky-300' : 'w-2 bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 flex items-stretch">
                <div className="relative w-full h-full overflow-hidden">
                  {!kioskSlideAnimating ? (
                    <div className="w-full h-full">
                      {renderKioskSlide(kioskSlides[kioskSlideIndex % kioskSlides.length])}
                    </div>
                  ) : (
                    <div className="relative w-full h-full">
                      <div
                        className={`absolute inset-0 ${kioskSlidePhase === 'prep' ? 'transition-none' : 'transition-transform duration-700 ease-in-out'} ${
                          kioskSlidePhase === 'run' ? '-translate-x-full' : 'translate-x-0'
                        }`}
                      >
                        {renderKioskSlide(kioskSlides[kioskSlideFromIndex % kioskSlides.length])}
                      </div>
                      <div
                        className={`absolute inset-0 ${kioskSlidePhase === 'prep' ? 'transition-none' : 'transition-transform duration-700 ease-in-out'} ${
                          kioskSlidePhase === 'run' ? 'translate-x-0' : 'translate-x-full'
                        }`}
                      >
                        {renderKioskSlide(kioskSlides[kioskSlideToIndex % kioskSlides.length])}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 flex items-center justify-between gap-4">
                <div className="text-white/75 text-sm sm:text-base font-semibold">Toque em qualquer lugar para continuar</div>
                <div className="hidden sm:block text-white/75 text-sm sm:text-base font-extrabold tracking-tight">
                  Contato: 81 9 7914-6126
                </div>
                <div className="sm:hidden flex items-center gap-2">
                  {kioskSlides.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-2 rounded-full transition-all ${idx === (kioskSlideIndex % kioskSlides.length) ? 'w-10 bg-sky-300' : 'w-2 bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="sm:hidden mt-3 text-center text-white/75 text-sm font-extrabold tracking-tight">
                Contato: 81 9 7914-6126
              </div>
            </div>
          </div>
        </div>
      )}
      {etapa === 'inicio' ? (
        <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900">
          <div className="w-[calc(100%-3rem)] sm:w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-widest text-slate-400">AIRE</div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Selecione uma opção</div>
                <div className="mt-1 text-sm sm:text-base text-slate-500 font-semibold">Entregar uma encomenda ou retirar com senha</div>
              </div>
              <div className="flex items-center gap-2">
                {usuario && (
                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      window.location.href = '/login'
                    }}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Sair do sistema"
                    aria-label="Sair do sistema"
                  >
                    <LogOut size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                  aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => setEtapa('selecionar_bloco')}
                className="w-full rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-600 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all px-6 py-8 sm:py-10"
              >
                <div className="flex items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Package className="w-9 h-9" />
                  </div>
                  <div className="text-left">
                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">Entregar</div>
                    <div className="mt-1 text-white/85 text-sm sm:text-base font-semibold">Depositar encomenda no gaveteiro</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/retirada?kiosk=1')}
                className="w-full rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-lg hover:shadow-xl transition-all px-6 py-8 sm:py-10"
              >
                <div className="flex items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <DoorOpen className="w-9 h-9 text-sky-700" />
                  </div>
                  <div className="text-left">
                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">Retirar</div>
                    <div className="mt-1 text-slate-500 text-sm sm:text-base font-semibold">Abrir porta usando a senha provisória</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Usuário e condomínio abaixo dos cards */}
            {usuario && (
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium">
                    {usuario.nome || usuario.email}
                  </span>
                </div>
                {condominio && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 font-medium">
                      {condominio.nome}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex flex-col flex-1 min-h-0">
              {/* Header com título e passos na mesma linha */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white border border-slate-200 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-sky-50 rounded-xl p-2 flex-shrink-0">
                {etapa === 'selecionar_bloco' ? (
                  <button
                    type="button"
                    onClick={reiniciar}
                    className="inline-flex items-center justify-center"
                    title="Voltar"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
                  </button>
                ) : etapa === 'selecionar_apartamento' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEtapa('selecionar_bloco')
                      setBlocoSelecionado('')
                      setDestinoAtivo(null)
                      setBuscaApto('')
                    }}
                    className="inline-flex items-center justify-center"
                    title="Voltar"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
                  </button>
                ) : etapa === 'selecionar_porta' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPortaSelecionada(null)
                      setEtapa('selecionar_apartamento')
                    }}
                    className="inline-flex items-center justify-center"
                    title="Voltar"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
                  </button>
                ) : (
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
                )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 truncate">{headerSubtitle}</div>
                  </div>
                </div>

                {/* Passos visuais */}
                <div className="flex items-center gap-1">
                  {isKiosk && (
                    <div className="mr-1 inline-flex items-center rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        className="h-7 px-3 rounded-lg bg-white text-slate-900 shadow-sm border border-slate-200 text-xs font-extrabold"
                        aria-current="page"
                      >
                        Entregar
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/retirada?kiosk=1')}
                        className="h-7 px-3 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-white/60 text-xs font-extrabold transition-colors"
                      >
                        Retirar
                      </button>
                    </div>
                  )}
                <button
                type="button"
                onClick={() => setEtapa('selecionar_bloco')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  etapa === 'selecionar_bloco'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : (etapa === 'selecionar_apartamento' || etapa === 'selecionar_porta' || etapa === 'sucesso')
                      ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">1</span>
                Bloco
              </button>

              <button
                type="button"
                disabled={!podeIrParaApto}
                onClick={() => {
                  if (!podeIrParaApto) return
                  if (!blocoSelecionado && destinatarios.length > 0) {
                    setBlocoSelecionado(destinatarios[0].bloco)
                    setBuscaApto('')
                  }
                  setEtapa('selecionar_apartamento')
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !podeIrParaApto
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : etapa === 'selecionar_apartamento'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : (etapa === 'selecionar_porta' || etapa === 'sucesso')
                        ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">2</span>
                Apto
              </button>

              <button
                type="button"
                disabled={!podeIrParaPorta}
                onClick={() => {
                  if (!podeIrParaPorta) return
                  setEtapa('selecionar_porta')
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !podeIrParaPorta
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : etapa === 'selecionar_porta'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : etapa === 'sucesso'
                        ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">3</span>
                Porta
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>


          {/* Layout principal com carrinho */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">

        {/* Carrinho lateral - mobile first */}
        {etapa !== 'sucesso' && etapa !== 'erro' && (
          <div className="lg:hidden order-2 bg-white rounded-2xl shadow-xl p-4">
            <div className="pb-3 mb-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-sky-600" />
                    <h3 className="text-lg font-extrabold text-gray-900 leading-tight">Carrinho</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Destinos selecionados</p>
                </div>
                <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-1 rounded-full">
                  {totalEncomendas}
                </span>
              </div>
            </div>
            
            {/* Lista simplificada para mobile */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {destinatarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-sm font-extrabold text-slate-800">Carrinho vazio</div>
                  <div className="mt-1 text-xs text-slate-500">Selecione um apartamento para adicionar.</div>
                </div>
              ) : (
                (() => {
                  const blocosUnicos = Array.from(new Set(destinatarios.map(d => d.bloco)))
                  return blocosUnicos.map(bloco => {
                    const aptosDoBloco = destinatarios.filter(d => d.bloco === bloco)
                    const totalBloco = aptosDoBloco.reduce((sum, d) => sum + (d.quantidade || 0), 0)
                    return (
                      <div
                        key={bloco}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-sky-500" />
                          <span className="font-extrabold text-gray-900 text-sm">{bloco}</span>
                          <span className="text-xs text-gray-500">({aptosDoBloco.length} aptos)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-1 rounded-full">
                            {totalBloco}
                          </span>
                          <button
                            onClick={() => removerBlocoDoCarrinho(bloco)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                            title="Remover bloco"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                })()
              )}
            </div>
          </div>
        )}

        {/* Carrinho desktop */}
        {etapa !== 'sucesso' && etapa !== 'erro' && (
          <div className="hidden lg:block lg:w-64 lg:shrink-0 bg-white rounded-2xl shadow-xl p-4 flex flex-col order-last min-h-0 h-full overflow-y-auto">
            <div className="pb-3 mb-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-sky-600" />
                    <h3 className="text-lg font-extrabold text-gray-900 leading-tight">Carrinho</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Destinos selecionados</p>
                </div>
                <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-1 rounded-full">
                  {totalEncomendas}
                </span>
              </div>
            </div>
            
            {/* Lista agrupada por bloco */}
            <div className="space-y-3 pb-3">
              {destinatarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-sm font-extrabold text-slate-800">Carrinho vazio</div>
                  <div className="mt-1 text-xs text-slate-500">Selecione um apartamento para adicionar.</div>
                </div>
              ) : (
                (() => {
                  const blocosUnicos = Array.from(new Set(destinatarios.map(d => d.bloco)))
                  return blocosUnicos.map(bloco => {
                    const aptosDoBloco = destinatarios.filter(d => d.bloco === bloco)
                    const totalBloco = aptosDoBloco.reduce((sum, d) => sum + (d.quantidade || 0), 0)
                    const aptosOrdenados = [...aptosDoBloco]
                      .map(d => d.apartamento)
                      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

                    const blocoAtivo = blocoSelecionado === bloco
                      || destinoAtivo?.bloco === bloco

                    const expanded = blocosCarrinhoExpandidos.has(bloco)
                    const MAX_APTOS_VISIVEIS = 6
                    const aptosVisiveis = expanded ? aptosOrdenados : aptosOrdenados.slice(0, MAX_APTOS_VISIVEIS)
                    const restantes = Math.max(0, aptosOrdenados.length - aptosVisiveis.length)
                    return (
                      <div
                        key={bloco}
                        className={`rounded-xl p-2 cursor-pointer transition-all border ${
                          blocoAtivo
                            ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-200 shadow-sm border-l-4 border-l-sky-500'
                            : 'bg-gray-50 border-transparent hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          setBlocoSelecionado(bloco)
                          setDestinoAtivo({ bloco, apartamento: '' })
                          setBuscaApto('')
                          setEtapa('selecionar_apartamento')
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-sky-500" />
                            <span className="font-extrabold text-gray-900 text-sm">{bloco}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center h-6 px-2 rounded-full text-[11px] font-extrabold tabular-nums border ${
                              blocoAtivo
                                ? 'bg-white text-sky-700 border-sky-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}>
                              {totalBloco}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removerBlocoDoCarrinho(bloco)
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Remover bloco"
                              aria-label="Remover bloco"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {aptosVisiveis.map((apto, idx) => {
                            const globalIdx = destinatarios.findIndex(d => d.bloco === bloco && d.apartamento === apto)
                            const qtd = destinatarios[globalIdx]?.quantidade || 1
                            const aptoAtivo = destinoAtivo?.bloco === bloco && destinoAtivo?.apartamento === apto
                            return (
                              <div
                                key={idx}
                                className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 text-xs w-full shadow-sm transition-colors ${
                                  aptoAtivo
                                    ? 'bg-sky-50 border-sky-600 ring-1 ring-sky-300'
                                    : blocoAtivo
                                      ? 'bg-white border-sky-200'
                                      : 'bg-white border-slate-200'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDestinoAtivo({ bloco, apartamento: apto })
                                }}
                              >
                                <div className="min-w-0 flex-1 grid grid-cols-[minmax(44px,1fr)_auto] grid-rows-[auto_auto] gap-x-1 gap-y-0 items-center">
                                  <div className="text-[8px] font-extrabold tracking-wide text-slate-400">APT</div>
                                  <div className="text-[8px] font-extrabold tracking-wide text-slate-400 text-center">QTD</div>

                                  <div className="min-w-0 pr-1">
                                    <div className="text-[14px] sm:text-[15px] font-extrabold text-slate-900 leading-none whitespace-nowrap">{apto}</div>
                                  </div>

                                  <div className="inline-flex items-center justify-center gap-0.5 rounded-lg border border-sky-200 bg-sky-50 px-0.5 py-0 font-extrabold text-sky-800">
                                    <button
                                      type="button"
                                      onClick={() => decrementarDestinatario(bloco, apto)}
                                      className="w-6 h-6 sm:w-7 sm:h-7 text-[15px] rounded-md flex items-center justify-center hover:bg-sky-100/70"
                                      aria-label="Diminuir quantidade"
                                    >
                                      −
                                    </button>
                                    <span className="min-w-[26px] text-center text-xs tabular-nums">{qtd}</span>
                                    <button
                                      type="button"
                                      onClick={() => incrementarDestinatario(bloco, apto)}
                                      className="w-6 h-6 sm:w-7 sm:h-7 text-[15px] rounded-md flex items-center justify-center hover:bg-sky-100/70"
                                      aria-label="Aumentar quantidade"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removerDestinatarioCompleto(bloco, apto)
                                  }}
                                  className="ml-1 w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors"
                                  aria-label="Remover apartamento"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )
                          })}

                          {restantes > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCarrinhoBloco(bloco)
                              }}
                              className="px-2 py-1 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded border border-sky-100"
                            >
                              Ver mais (+{restantes})
                            </button>
                          )}

                          {expanded && aptosOrdenados.length > MAX_APTOS_VISIVEIS && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCarrinhoBloco(bloco)
                              }}
                              className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200"
                            >
                              Ver menos
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                })()
              )}
            </div>
            
            {/* Botões do carrinho */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (etapa === 'selecionar_porta') {
                      void confirmarOcupacao().catch(() => {})
                      return
                    }
                    irParaSelecaoPorta()
                  }}
                  disabled={destinatarios.length === 0 || (etapa === 'selecionar_porta' && !portaSelecionada)}
                  className={`col-span-1 px-4 sm:px-3 py-3 sm:py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap ${
                    destinatarios.length === 0 || (etapa === 'selecionar_porta' && !portaSelecionada)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {etapa === 'selecionar_porta' ? (
                    <>Confirmar</>
                  ) : (
                    <><ArrowRight size={18} />Porta</>
                  )}
                </button>
                <button
                  onClick={reiniciar}
                  className="col-span-1 py-3 sm:py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-sm sm:text-base font-semibold transition-colors whitespace-nowrap"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Conteúdo principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex-1 min-w-0 flex flex-col relative">
          <div className="relative z-10 flex-1 flex flex-col min-h-0">
        
        {/* ETAPA 1: Selecionar Bloco */}
        {etapa === 'selecionar_bloco' && (
          <div className="p-4 flex flex-col flex-1 min-h-0">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-sky-600" />
                </div>
                <h2 className="relative text-xl sm:text-2xl font-black tracking-tight text-slate-900 after:content-[''] after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-sky-500">
                  Qual bloco?
                </h2>
              </div>
            </div>
            {/* Grid de blocos */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 flex-1 content-start">
              {blocos.map((bloco) => (
                (() => {
                  const blocoJaNoCarrinho = blocosNoCarrinho.has(bloco.nome)
                  const blocoAtivo = blocoSelecionado === bloco.nome || destinoAtivo?.bloco === bloco.nome
                  return (
                <button
                  key={bloco.uid}
                  onClick={() => selecionarBloco(bloco.nome)}
                  className={`relative p-3 rounded-lg border-2 transition-all text-center h-fit ${
                    blocoAtivo
                      ? 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-600 ring-2 ring-sky-300'
                      : blocoJaNoCarrinho
                        ? 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 hover:border-sky-300 hover:from-sky-100 hover:to-blue-100'
                        : 'bg-gradient-to-br from-sky-50 to-blue-50 border-transparent hover:border-sky-300 hover:from-sky-100 hover:to-blue-100'
                  }`}
                >
                  {blocoJaNoCarrinho && (
                    <span className="pointer-events-none absolute right-1 top-1 inline-flex items-center justify-center rounded-full bg-white/80 border border-emerald-200 w-5 h-5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </span>
                  )}
                  <span className="text-lg font-bold text-sky-700">{bloco.nome}</span>
                </button>
                  )
                })()
              ))}
              {blocos.length === 0 && (
                <p className="col-span-full text-center text-gray-500 py-8">Nenhum bloco cadastrado</p>
              )}
            </div>

            {destinatarios.length > 0 && (
              <div className="mt-auto pt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={irParaSelecaoPorta}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-green-200 bg-white text-green-700 font-extrabold text-sm hover:bg-green-50 hover:border-green-300 transition-colors"
                >
                  <DoorOpen className="w-4 h-4" />
                  Ir para porta
                </button>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 2: Selecionar Apartamento */}
        {etapa === 'selecionar_apartamento' && (
          <div className="p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 mb-5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                  <Home className="w-5 h-5 text-sky-600" />
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="relative text-xl sm:text-2xl font-black tracking-tight text-slate-900 after:content-[''] after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-sky-500">
                    Qual apartamento?
                  </h2>
                  {blocoSelecionado && (
                    <span className="inline-flex items-center h-7 px-2.5 rounded-full border border-sky-200 bg-sky-50 text-sky-800 text-xs font-extrabold">
                      {(blocoSelecionado.trim().toLowerCase().startsWith('bloco')
                        ? blocoSelecionado.trim()
                        : `Bloco ${blocoSelecionado.trim()}`)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={voltarParaBlocos}
                className="inline-flex items-center gap-2 font-extrabold text-sky-700 whitespace-nowrap px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 hover:border-sky-300 transition-colors shadow-sm"
              >
                <span className="text-lg leading-none">+</span>
                <span className="text-xs sm:text-sm leading-none">bloco</span>
              </button>
            </div>
            
            {/* Grid de apartamentos com scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="flex flex-col gap-3 pb-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 content-start">
                  {apartamentosFiltrados.map((apto) => {
                    const jaAdicionado = destinatarios.some(
                      d => d.bloco === blocoSelecionado && d.apartamento === apto.numero
                    )
                    const aptoAtivo = destinoAtivo?.bloco === blocoSelecionado && destinoAtivo?.apartamento === apto.numero

                    const blocoCands = normalizeBlocoCandidates(blocoSelecionado)
                    const aptoCands = normalizeAptoCandidates(apto.numero)
                    const temMorador = blocoCands.some(b => aptoCands.some(a => moradoresIndex.has(`${b}::${a}`)))

                    const classesBase = temMorador
                      ? ''
                      : 'opacity-60 cursor-not-allowed'

                    const tone = !temMorador
                      ? 'bg-slate-50 border-slate-200'
                      : aptoAtivo
                        ? 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-600 ring-2 ring-sky-300'
                        : jaAdicionado
                          ? 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 hover:border-sky-300 hover:from-sky-100 hover:to-blue-100'
                          : 'bg-gradient-to-br from-sky-50 to-blue-50 border-transparent hover:border-sky-300 hover:from-sky-100 hover:to-blue-100'

                    return (
                      <button
                        key={apto.uid}
                        onClick={() => {
                          if (!temMorador) return
                          const existe = destinatarios.some(d => d.bloco === blocoSelecionado && d.apartamento === apto.numero)
                          if (!existe) {
                            setDestinoAtivo({ bloco: blocoSelecionado, apartamento: apto.numero })
                          } else if (aptoAtivo) {
                            setDestinoAtivo({ bloco: blocoSelecionado, apartamento: '' })
                          }
                          adicionarDestinatario(apto.numero)
                        }}
                        disabled={!temMorador}
                        aria-disabled={!temMorador}
                        className={`relative p-3 rounded-lg border-2 transition-all text-center h-fit ${tone} ${classesBase}`}
                      >
                        {jaAdicionado && (
                          <span className="pointer-events-none absolute right-1 top-1 inline-flex items-center justify-center rounded-full bg-white/80 border border-emerald-200 w-5 h-5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          </span>
                        )}
                        {!temMorador && (
                          <span className="pointer-events-none absolute left-1 top-1 inline-flex items-center justify-center rounded-full bg-white/80 border border-slate-200 w-5 h-5">
                            <Lock className="w-3 h-3 text-slate-500" />
                          </span>
                        )}
                        <span className={`text-lg font-bold ${temMorador ? 'text-sky-700' : 'text-slate-500'}`}>
                          {apto.numero}
                        </span>
                        <div className="mt-0.5 text-[10px] font-semibold text-slate-400">Apartamento</div>
                      </button>
                    )
                  })}
                </div>

                {apartamentosFiltrados.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Nenhum apartamento cadastrado</p>
                )}
              </div>
            </div>
            
            {/* Rodapé com ações */}
            <div className="mt-auto pt-4 border-t border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-end">
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={voltarParaBlocos}
                    className="px-4 py-2 text-sky-600 font-medium text-sm hover:bg-sky-50 rounded-lg transition-all"
                  >
                    + Blocos
                  </button>
                  <button
                    onClick={irParaSelecaoPorta}
                    disabled={destinatarios.length === 0}
                    className="px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-500"
                  >
                    <DoorOpen className="w-4 h-4" />
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 3: Selecionar Porta */}
        {etapa === 'selecionar_porta' && (
          <div className="p-4 flex flex-col flex-1 min-h-0">
            <div className="pb-2 mb-2 flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                      <DoorOpen className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="relative text-xl sm:text-2xl font-black tracking-tight text-slate-900 after:content-[''] after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-sky-500">
                      Qual porta do gaveteiro?
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setEtapa('selecionar_bloco')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 whitespace-nowrap px-2.5 py-1.5 rounded-lg border border-transparent hover:border-sky-100 hover:bg-sky-50/60 hover:text-sky-700 transition-colors"
                >
                  <ChevronLeft size={16} />
                  Adicionar mais
                </button>
              </div>
            </div>

            {/* Grid de portas */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="min-h-0 rounded-2xl bg-white border border-slate-200 p-2">
                <div className="grid gap-2 pb-2 grid-cols-[repeat(auto-fit,minmax(80px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(84px,1fr))]">
                {portasDisponiveisPaginadas.map((porta) => {
                  const selected = portaSelecionada?.uid === porta.uid
                  return (
                    <button
                      key={porta.uid}
                      onClick={() => abrirConfirmacaoPorta(porta)}
                      aria-pressed={selected}
                      className={`group relative rounded-xl border text-center transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 active:scale-[0.98] active:shadow-none ${
                        selected
                          ? 'border-sky-400 bg-sky-50/60 ring-2 ring-sky-200 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50 hover:shadow-sm'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-5 h-5 text-sky-600" />
                        </div>
                      )}
                      <div className="w-full h-full px-2 py-2.5 flex flex-col items-center">
                        <div className="flex-1 w-full flex flex-col items-center justify-center">
                          <div className={`text-[22px] sm:text-[24px] font-extrabold tracking-tight ${selected ? 'text-sky-700' : 'text-slate-900'}`}>
                            {porta.numero_porta}
                          </div>
                        </div>

                        <div className="text-[10px] font-semibold text-slate-400">
                          Porta
                        </div>
                      </div>
                    </button>
                  )
                })}
                </div>
              </div>
              {portasDisponiveis.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                  <p className="text-gray-500">Nenhuma porta disponível</p>
                </div>
              )}
            </div>

            {/* Botão confirmar */}
            <div className="-mx-4 mt-auto px-4 pt-2 pb-2 bg-white border-t border-gray-100 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={portaPageSize}
                    onChange={(e) => setPortaPageSize(Number(e.target.value))}
                    className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-700"
                    aria-label="Quantidade por página"
                  >
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                    <option value={90}>90</option>
                    <option value={120}>120</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setPortaPage(p => Math.max(1, p - 1))}
                    disabled={portaPage <= 1}
                    className={`h-8 px-3 rounded-lg text-sm font-semibold transition-all ${portaPage <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                  >
                    Anterior
                  </button>

                  <div className="text-sm font-semibold text-gray-600 min-w-[56px] text-center">
                    {portaPage}/{portasDisponiveisTotalPages}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPortaPage(p => Math.min(portasDisponiveisTotalPages, p + 1))}
                    disabled={portaPage >= portasDisponiveisTotalPages}
                    className={`h-8 px-3 rounded-lg text-sm font-semibold transition-all ${portaPage >= portasDisponiveisTotalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                  >
                    Próxima
                  </button>

                  <div className="text-xs text-gray-400">
                    Exibindo {(portasDisponiveis.length === 0 ? 0 : (portaPage - 1) * portaPageSize + 1)}–{Math.min(portasDisponiveis.length, portaPage * portaPageSize)} de {portasDisponiveis.length}
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={reiniciar}
                    className="px-4 py-2.5 font-bold rounded-xl transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      void confirmarOcupacao().catch(() => {})
                    }}
                    disabled={!portaSelecionada}
                    className={`px-4 py-2.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 min-w-[200px] ${
                      !portaSelecionada
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA: Sucesso */}
        {etapa === 'sucesso' && (
          <div className="p-4 flex flex-col items-center justify-center flex-1 min-h-0">
            <div className={`w-full transition-all ${portaSensorFechada ? 'max-w-lg' : 'max-w-5xl'}`}>
              <div className={`rounded-[32px] border shadow-xl overflow-hidden bg-gradient-to-br ${
                portaSensorFechada
                  ? 'from-emerald-50 via-white to-white border-emerald-100'
                  : portaSensorAberta
                    ? 'from-amber-50 via-white to-white border-amber-100'
                    : 'from-sky-50 via-white to-white border-sky-100'
              }`}>
                {portaSensorFechada ? (
                <div className="px-8 py-8 flex flex-col items-center">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-600 text-white flex items-center justify-center shadow-lg">
                      <span className="text-3xl font-extrabold leading-none">{portaSelecionadaAtualizada?.numero_porta}</span>
                    </div>
                    <div>
                      <div className="text-xs font-extrabold tracking-[0.2em] text-emerald-600 uppercase">Sucesso</div>
                      <div className="text-xl font-extrabold tracking-tight text-slate-900">Entrega confirmada</div>
                    </div>
                  </div>

                  {/* Comprovante + WhatsApp */}
                  <div className="w-full mt-6 space-y-4">
                    {/* QR row */}
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="shrink-0 rounded-xl bg-white p-1.5 border border-slate-100">
                        <QRCode value={comprovanteUrl} size={72} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800">Comprovante</div>
                        <button
                          type="button"
                          onClick={copiarComprovanteTotem}
                          className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                            copiadoComprovante ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {copiadoComprovante ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiadoComprovante ? 'Copiado!' : 'Copiar link'}
                        </button>
                      </div>
                    </div>

                    {/* WhatsApp — destaque */}
                    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                          <Phone className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-emerald-900">Notificar entregador</div>
                          <div className="text-[11px] text-emerald-700/70">Informe o WhatsApp para enviar o comprovante</div>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          value={whatsappEntregador}
                          onChange={e => handleWhatsappChange(e.target.value)}
                          inputMode="tel"
                          placeholder="(00) 00000-0000"
                          disabled={whatsappEntregadorEnviado}
                          className={`h-12 w-full rounded-xl border px-4 text-base font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all ${
                            whatsappEntregadorErro
                              ? 'border-rose-300 bg-rose-50/60 focus:ring-rose-200 text-rose-900'
                              : whatsappEntregadorEnviado
                                ? 'border-emerald-300 bg-white text-emerald-800'
                                : 'border-emerald-200 bg-white focus:ring-emerald-300'
                          }`}
                        />
                        {enviandoWhatsappEntregador ? (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                          </div>
                        ) : whatsappEntregadorEnviado ? (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </div>
                        ) : null}
                      </div>
                      {whatsappEntregadorErro ? (
                        <div className="mt-2 text-xs font-semibold text-rose-600">{whatsappEntregadorErro}</div>
                      ) : whatsappEntregadorEnviado ? (
                        <div className="mt-2 text-xs font-semibold text-emerald-700">Notificação enviada com sucesso.</div>
                      ) : (
                        <div className="mt-2 text-[11px] text-emerald-600/60">Envio automático ao completar o número.</div>
                      )}
                    </div>

                    {/* Finalizar */}
                    <button
                      type="button"
                      onClick={reiniciar}
                      className="w-full h-14 rounded-2xl font-extrabold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg hover:from-emerald-700 hover:to-green-700 text-lg"
                    >
                      <Package className="w-5 h-5" />
                      Finalizar
                    </button>
                  </div>
                </div>
                ) : (
                <div className="grid grid-cols-12 min-h-[380px]">
                  <div className="col-span-12 lg:col-span-7 p-6 flex flex-col">
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold tracking-[0.18em] text-slate-400">OPERAÇÃO DO TOTEM</div>
                            <div className="mt-2 flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center shadow-lg">
                                <span className="text-3xl font-extrabold leading-none">{portaSelecionadaAtualizada?.numero_porta}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-lg font-extrabold tracking-tight text-slate-900">Porta selecionada</div>
                                <div className="text-sm font-semibold text-slate-500">Depósito em andamento</div>
                              </div>
                            </div>
                          </div>

                          <div className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-extrabold uppercase tracking-wide border ${
                            portaSensorAberta
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                          }`}>
                            {portaSensorAberta ? 'Porta aberta' : 'Aguardando sensor'}
                          </div>
                        </div>

                        <div className="mt-5 rounded-3xl border border-slate-200 bg-white/80 shadow-sm p-6">
                          <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                            Deposite a mercadoria no gaveteiro
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-600">
                            Após depositar, feche a porta. O sensor confirmará automaticamente.
                          </div>

                          {portaSensorAberta ? (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                              <div className="text-xs font-extrabold tracking-wide text-amber-900">AGUARDANDO FECHAMENTO</div>
                              <div className="mt-1 text-sm font-semibold text-amber-900/90">Aguardando o sensor confirmar o fechamento…</div>
                            </div>
                          ) : null}
                        </div>

                    <div className="mt-6">
                        <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3">
                            <button
                              type="button"
                              onClick={confirmarFechamentoManual}
                              disabled={cancelandoOperacao || confirmandoFechamento}
                              className="relative h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-extrabold flex items-center justify-center shadow-lg hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-50 overflow-hidden"
                            >
                              {depositoDeadline && !confirmandoFechamento ? (
                                <div
                                  className="absolute bottom-0 left-0 h-1 bg-white/35"
                                  style={{ width: `${Math.min(100, Math.max(0, (depositoRestanteMs / 90000) * 100))}%` }}
                                />
                              ) : null}
                              <span className="w-full px-4 inline-flex items-center justify-between gap-3">
                                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                  <CheckCircle2 className={`w-5 h-5 ${confirmandoFechamento ? 'animate-pulse' : ''}`} />
                                  {confirmandoFechamento ? 'Confirmando...' : 'Confirmar entrega'}
                                </span>
                                {depositoDeadline && !confirmandoFechamento ? (
                                  <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-white/15 text-white text-sm font-extrabold tabular-nums whitespace-nowrap">
                                    {formatarTempo(depositoRestanteMs)}
                                  </span>
                                ) : null}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => cancelarOperacaoTotem('Cancelamento pelo entregador (Totem)')}
                              disabled={cancelandoOperacao || confirmandoFechamento}
                              className="h-12 w-full rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-5 h-5" />
                              <span className="whitespace-nowrap">Cancelar</span>
                            </button>
                          </div>
                        </div>
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-5 bg-gradient-to-b from-slate-50 to-white border-t lg:border-t-0 lg:border-l border-slate-200 p-7 flex flex-col">
                      <div className="flex-1 flex flex-col">
                        <div className="flex-1 rounded-3xl border border-slate-200 bg-white shadow-sm flex items-center justify-center p-6">
                          <img
                            src="/3_delivery%20(1).gif"
                            alt=""
                            className="w-[360px] max-w-full h-auto max-h-[240px] object-contain"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        )}

        {etapa === 'erro' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>

            <h2 className="text-2xl font-bold text-red-600 mb-2">Erro</h2>
            <p className="text-gray-600 mb-6">{mensagemErro}</p>

            <button
              onClick={reiniciar}
              className="px-8 py-4 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        </div>
        </div>
        </div>
      </div>
    </div>
  )}
  </div>
)
}
