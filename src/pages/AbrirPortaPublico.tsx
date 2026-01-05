import { useState, useEffect, useRef } from 'react'
import { DoorOpen, Lock, Unlock, CheckCircle2, XCircle, Loader2, Package, KeyRound, Camera } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { abrirPortaEsp32 } from '../services/gaveteiroService'
import { useAuth } from '../contexts/AuthContext'

// Token padrão ESP32 (em produção, use variável de ambiente)
const ESP32_TOKEN = process.env.NEXT_PUBLIC_ESP32_DEFAULT_TOKEN || null

interface PortaInfo {
  porta_uid: string
  numero_porta: number
  gaveteiro_nome: string
  condominio_nome: string
  bloco: string
  apartamento: string
  esp32_ip: string | null  // IP do ESP32 do gaveteiro
}

type StatusAbertura = 'idle' | 'validando' | 'abrindo' | 'aberta' | 'erro' | 'aguardando_fechar'

type MetodoAutenticacao = 'senha' | 'facial'
type StatusFacial = 'idle' | 'iniciando_camera' | 'camera_pronta' | 'reconhecendo' | 'erro'

export default function AbrirPortaPublico() {
  const { condominio } = useAuth()
  const [senha, setSenha] = useState('')
  const [showKeypad, setShowKeypad] = useState(false)
  const [status, setStatus] = useState<StatusAbertura>('idle')
  const [mensagem, setMensagem] = useState('')
  const [portaInfo, setPortaInfo] = useState<PortaInfo | null>(null)
  const [tempoRestante, setTempoRestante] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const [metodo, setMetodo] = useState<MetodoAutenticacao>('senha')
  const [statusFacial, setStatusFacial] = useState<StatusFacial>('idle')
  const [mensagemFacial, setMensagemFacial] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const isKiosk =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('kiosk') === '1'

  // Foco automático no input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop())
        cameraStreamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (metodo !== 'facial') return
    if (!cameraStreamRef.current) return
    if (!videoRef.current) return
    const el = videoRef.current as any
    if (el.srcObject !== cameraStreamRef.current) {
      el.srcObject = cameraStreamRef.current
    }
  }, [metodo, statusFacial, showKeypad])

  // Timer para fechar automaticamente
  useEffect(() => {
    if (tempoRestante > 0) {
      const timer = setTimeout(() => {
        setTempoRestante(t => t - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (tempoRestante === 0 && status === 'aguardando_fechar') {
      // Tempo esgotado, resetar
      resetar()
    }
  }, [tempoRestante, status])

  const resetar = () => {
    setSenha('')
    setShowKeypad(false)
    setStatus('idle')
    setMensagem('')
    setPortaInfo(null)
    setTempoRestante(0)
    setMetodo('senha')
    setStatusFacial('idle')
    setMensagemFacial('')
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      ;(videoRef.current as any).srcObject = null
    }
    inputRef.current?.focus()
  }

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      ;(videoRef.current as any).srcObject = null
    }
  }

  const startCamera = async () => {
    if (cameraStreamRef.current) return
    setStatusFacial('iniciando_camera')
    setMensagemFacial('Iniciando câmera...')

    try {
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: 'user' }
          },
          audio: false
        })
      } catch {
        // Fallback: alguns browsers/dispositivos não suportam 'exact'
      }

      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'user' }
            },
            audio: false
          })
        } catch {
          // Fallback final
        }
      }

      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
      }

      cameraStreamRef.current = stream
      setStatusFacial('camera_pronta')
      setMensagemFacial('Olhe para a câmera')
    } catch (e: any) {
      console.error('Erro câmera:', e)
      setStatusFacial('erro')
      setMensagemFacial('Não foi possível acessar a câmera. Use a senha.')
    }
  }

  const alternarMetodo = async (next: MetodoAutenticacao) => {
    setMetodo(next)
    setMensagem('')
    setStatus('idle')
    setPortaInfo(null)

    if (next === 'facial') {
      setShowKeypad(false)
      await startCamera()
    } else {
      stopCamera()
      setStatusFacial('idle')
      setMensagemFacial('')
      inputRef.current?.focus()
    }
  }

  const reconhecerFacial = async () => {
    if (!isKiosk) return
    if (metodo !== 'facial') return
    if (!condominio?.uid) {
      setStatusFacial('erro')
      setMensagemFacial('Condomínio não identificado. Faça login novamente.')
      return
    }

    if (statusFacial !== 'camera_pronta') {
      await startCamera()
      if (statusFacial !== 'camera_pronta') return
    }

    setStatusFacial('reconhecendo')
    setMensagemFacial('Reconhecendo...')

    window.setTimeout(() => {
      setStatusFacial('camera_pronta')
      setMensagemFacial('Reconhecimento ainda não integrado. Use a senha por enquanto.')
    }, 900)
  }

  const validarSenha = async () => {
    if (metodo !== 'senha') return
    if (senha.length < 4) {
      setMensagem('Digite a senha completa')
      return
    }

    if (isKiosk) {
      setShowKeypad(false)
    }
    setStatus('validando')
    setMensagem('Validando senha...')

    try {
      // 1. Buscar senha provisória ativa
      const { data: senhaData, error: senhaError } = await supabase
        .from('gvt_senhas_provisorias')
        .select(`
          uid,
          porta_uid,
          bloco,
          apartamento,
          status
        `)
        .eq('senha', senha)
        .eq('status', 'ATIVA')
        .single()

      if (senhaError || !senhaData) {
        // Tentar senha mestre
        const { data: condominios } = await supabase
          .from('gvt_condominios')
          .select('uid, nome, senha_mestre')
          .eq('senha_mestre', senha)
          .limit(1)

        if (condominios && condominios.length > 0) {
          setStatus('erro')
          setMensagem('Senha mestre não pode ser usada nesta tela. Use o painel administrativo.')
          return
        }

        setStatus('erro')
        setMensagem('Senha inválida ou já utilizada')
        setSenha('')
        if (isKiosk) {
          setShowKeypad(true)
        }
        return
      }

      // 2. Buscar informações da porta e ESP32 do gaveteiro
      const { data: portaData, error: portaError } = await supabase
        .from('gvt_portas')
        .select(`
          uid,
          numero_porta,
          gaveteiro_uid,
          gvt_gaveteiros!inner (
            nome,
            esp32_ip,
            esp32_token,
            condominio_uid,
            gvt_condominios!inner (
              nome
            )
          )
        `)
        .eq('uid', senhaData.porta_uid)
        .single()

      if (portaError || !portaData) {
        setStatus('erro')
        setMensagem('Erro ao buscar informações da porta')
        return
      }

      const gaveteiro = portaData.gvt_gaveteiros as any
      const condominio = gaveteiro?.gvt_condominios as any
      const esp32Ip = gaveteiro?.esp32_ip

      if (!esp32Ip) {
        setStatus('erro')
        setMensagem('Gaveteiro não configurado. Contate o administrador.')
        return
      }

      setPortaInfo({
        porta_uid: portaData.uid,
        numero_porta: portaData.numero_porta,
        gaveteiro_nome: gaveteiro?.nome || 'Gaveteiro',
        condominio_nome: condominio?.nome || 'Condomínio',
        bloco: senhaData.bloco,
        apartamento: senhaData.apartamento,
        esp32_ip: esp32Ip
      })

      // 3. Abrir a porta via ESP32
      setStatus('abrindo')
      setMensagem('Abrindo porta...')

      // Usar IP do ESP32 configurado no gaveteiro
      const esp32BaseUrl = `http://${esp32Ip}`
      const esp32Token = gaveteiro?.esp32_token || ESP32_TOKEN

      try {
        await abrirPortaEsp32({
          baseUrl: esp32BaseUrl,
          token: esp32Token,
          numeroPorta: portaData.numero_porta, // Envia o numero da porta fisica
          timeoutMs: 10000
        })

        // 4. Marcar senha como usada
        await supabase
          .from('gvt_senhas_provisorias')
          .update({
            status: 'CANCELADA',
            usada_em: new Date().toISOString()
          })
          .eq('uid', senhaData.uid)

        // 5. Registrar movimentação
        await supabase
          .from('gvt_movimentacoes_porta')
          .insert({
            condominio_uid: gaveteiro?.condominio_uid || condominio?.uid,
            porta_uid: senhaData.porta_uid,
            acao: 'CANCELAR',
            status_resultante: 'OCUPADO',
            timestamp: new Date().toISOString(),
            origem: 'TOTEM',
            observacao: `Retirada: ${senhaData.bloco} - Apto ${senhaData.apartamento}`
          })

        // 6. Verificar se todas as senhas foram usadas
        const { data: senhasAtivas } = await supabase
          .from('gvt_senhas_provisorias')
          .select('uid')
          .eq('porta_uid', senhaData.porta_uid)
          .eq('status', 'ATIVA')

        if (!senhasAtivas || senhasAtivas.length === 0) {
          // Liberar porta
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

        setStatus('aberta')
        setMensagem('Porta aberta! Retire sua encomenda.')
        setTempoRestante(30) // 30 segundos para retirar

        // Aguardar fechamento
        setTimeout(() => {
          setStatus('aguardando_fechar')
        }, 3000)

      } catch (espError: any) {
        console.error('Erro ESP32:', espError)
        setStatus('erro')
        setMensagem('Erro ao comunicar com a fechadura. Tente novamente.')
      }

    } catch (error) {
      console.error('Erro:', error)
      setStatus('erro')
      setMensagem('Erro ao processar. Tente novamente.')
    }
  }

  const showKeypadIfKiosk = () => {
    if (!isKiosk) return
    if (!(status === 'idle' || status === 'erro')) return
    if (portaInfo) return
    setShowKeypad(true)
  }

  const updateSenhaFromKeypad = (next: string) => {
    setSenha(next)
    if (status === 'erro') {
      setStatus('idle')
      setMensagem('')
    }
  }

  const keypadDigit = (digit: string) => {
    updateSenhaFromKeypad((senha + digit).slice(0, 8))
  }

  const keypadBackspace = () => {
    updateSenhaFromKeypad(senha.slice(0, -1))
  }

  const keypadClear = () => {
    updateSenhaFromKeypad('')
  }

  const showKioskKeypad =
    isKiosk &&
    metodo === 'senha' &&
    (status === 'idle' || status === 'erro' || status === 'validando' || status === 'abrindo') &&
    !portaInfo

  const kioskSenhaProcessando = isKiosk && metodo === 'senha' && (status === 'validando' || status === 'abrindo')
  const kioskSenhaMostrarUI = isKiosk && metodo === 'senha' && (status === 'idle' || status === 'erro' || kioskSenhaProcessando)

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validarSenha()
    }
  }

  const handleSenhaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Apenas números
    const valor = e.target.value.replace(/\D/g, '')
    setSenha(valor)
    
    // Limpar mensagem de erro ao digitar
    if (status === 'erro') {
      setStatus('idle')
      setMensagem('')
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900 flex items-center justify-center p-3"
    >
      <div
        className={`w-full ${
          showKioskKeypad
            ? (metodo === 'senha' ? 'max-w-[720px]' : 'max-w-4xl')
            : isKiosk && metodo === 'facial'
              ? 'max-w-3xl'
              : 'max-w-md'
        }`}
      >
        {/* Logo/Header */}
        <div className="mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full">
                <Package className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Retirada de Encomenda</h1>
            </div>
            <p className="text-white/70 mt-2">Digite sua senha para abrir a porta</p>
          </div>
        </div>

        {/* Card Principal */}
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl overflow-hidden">
          {/* Status da Porta - Header com Bloco e Apartamento em destaque */}
          {portaInfo && (
            <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-5 py-4 text-white">
              {/* Bloco e Apartamento em destaque */}
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-2.5 text-center">
                  <p className="text-xs uppercase tracking-wider opacity-80">Bloco</p>
                  <p className="text-2xl font-bold">{portaInfo.bloco}</p>
                </div>
                <div className="text-3xl font-light opacity-50">•</div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-2.5 text-center">
                  <p className="text-xs uppercase tracking-wider opacity-80">Apartamento</p>
                  <p className="text-2xl font-bold">{portaInfo.apartamento}</p>
                </div>
              </div>
              {/* Porta */}
              <div className="flex items-center justify-center">
                <div className="bg-white/10 rounded-full px-4 py-1 flex items-center gap-2">
                  <DoorOpen className="w-4 h-4" />
                  <span className="text-sm">Porta <strong>#{portaInfo.numero_porta}</strong></span>
                </div>
              </div>
            </div>
          )}

          <div
            className={
              showKioskKeypad
                ? 'grid items-stretch justify-center grid-cols-1 lg:grid-cols-[380px_320px] divide-y divide-slate-200 lg:divide-y-0 lg:divide-x'
                : ''
            }
          >
            <div
              className={`${isKiosk && metodo === 'facial' && !showKioskKeypad ? 'p-5' : 'p-6'} ${
                showKioskKeypad && metodo === 'senha' ? 'flex flex-col' : ''
              }`}
            >
              {/* Estado: Idle ou Erro */}
              {(status === 'idle' || status === 'erro' || kioskSenhaMostrarUI) && (
                <>
                  <div className={showKioskKeypad ? 'flex flex-col' : ''}>
                    {isKiosk && (
                      <div className="mb-4 flex items-center justify-center">
                        <div className="inline-flex items-center rounded-2xl bg-slate-100 p-1 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => alternarMetodo('senha')}
                            className={`h-10 px-6 rounded-xl text-sm font-extrabold transition-colors ${
                              metodo === 'senha'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                : 'text-slate-600 hover:text-sky-700 hover:bg-white/80'
                            }`}
                          >
                            Senha
                          </button>
                          <button
                            type="button"
                            onClick={() => alternarMetodo('facial')}
                            className={`h-10 px-6 rounded-xl text-sm font-extrabold transition-colors inline-flex items-center gap-2 ${
                              metodo === 'facial'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                : 'text-slate-600 hover:text-sky-700 hover:bg-white/80'
                            }`}
                          >
                            <Camera className="w-4 h-4" />
                            Facial
                          </button>
                        </div>
                      </div>
                    )}

                    {isKiosk && metodo === 'facial' && !showKioskKeypad && (
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-3 items-stretch">
                        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video w-full max-h-[260px] md:max-h-[320px]">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                          />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-extrabold tracking-widest text-slate-400">FACIAL</div>
                            <div className="mt-2 text-sm font-semibold text-slate-700">
                              {mensagemFacial || (statusFacial === 'camera_pronta' ? 'Olhe para a câmera' : 'Iniciando...')}
                            </div>
                            <div className="mt-2 text-xs font-semibold text-slate-500">
                              Se a porta estiver compartilhada, será necessário usar senha.
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              onClick={reconhecerFacial}
                              disabled={statusFacial !== 'camera_pronta'}
                              className="h-10 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-700 text-white hover:from-emerald-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-extrabold text-sm transition-all inline-flex items-center justify-center gap-2"
                            >
                              {statusFacial === 'reconhecendo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                              Reconhecer agora
                            </button>
                            <button
                              type="button"
                              onClick={() => alternarMetodo('senha')}
                              className="h-10 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-extrabold text-sm transition-colors"
                            >
                              Usar senha
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {metodo === 'senha' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          <KeyRound className="w-4 h-4 inline mr-1" />
                          Senha de Retirada
                        </label>
                        <input
                          ref={inputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={8}
                          value={senha}
                          readOnly={isKiosk}
                          onFocus={showKeypadIfKiosk}
                          onClick={showKeypadIfKiosk}
                          onChange={handleSenhaChange}
                          onKeyPress={handleKeyPress}
                          placeholder={isKiosk ? 'Senha' : 'Digite a senha'}
                          className={`w-full text-center text-3xl font-mono tracking-widest py-4 px-6 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                            status === 'erro'
                              ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50'
                              : 'border-slate-200 bg-slate-50 focus:border-sky-500 focus:ring-sky-200'
                          } ${isKiosk ? 'caret-transparent cursor-pointer select-none' : ''}`}
                        />

                        {showKioskKeypad && metodo === 'senha' && (status === 'idle' || status === 'erro' || status === 'validando' || status === 'abrindo') && (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-extrabold tracking-widest text-slate-400">COMO RETIRAR</div>
                            <div className="mt-2 text-xs font-semibold text-slate-600">
                              <ol className="list-decimal list-inside space-y-1">
                                <li>Digite a senha no teclado ao lado.</li>
                                <li>Toque em <span className="font-extrabold">Abrir Porta</span>.</li>
                                <li>Retire sua encomenda.</li>
                              </ol>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isKiosk && metodo === 'senha' && showKioskKeypad && (
                      <div className="mt-3 flex items-center justify-center">
                        <div className="inline-flex items-center rounded-2xl bg-slate-100 p-1 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href = '/totem-kiosk'
                            }}
                            disabled={kioskSenhaProcessando}
                            className={`h-11 px-7 rounded-xl text-slate-600 hover:text-sky-700 hover:bg-white/80 text-sm font-extrabold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${kioskSenhaProcessando ? 'pointer-events-none' : ''}`}
                          >
                            Entregar
                          </button>
                          <button
                            type="button"
                            disabled={kioskSenhaProcessando}
                            className={`h-11 px-7 rounded-xl bg-white text-slate-900 shadow-sm border border-slate-200 text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed ${kioskSenhaProcessando ? 'pointer-events-none' : ''}`}
                            aria-current="page"
                          >
                            Retirar
                          </button>
                        </div>
                      </div>
                    )}

                    {!showKioskKeypad && metodo === 'senha' && (
                      <button
                        onClick={validarSenha}
                        disabled={senha.length < 4}
                        className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white font-semibold rounded-xl hover:from-sky-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Unlock className="w-5 h-5" />
                        Abrir Porta
                      </button>
                    )}

                    {isKiosk && !showKioskKeypad && (
                      <div className="mt-3 flex items-center justify-center">
                        <div className="inline-flex items-center rounded-2xl bg-slate-100 p-1 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              window.location.href = '/totem-kiosk'
                            }}
                            className="h-10 px-6 rounded-xl text-slate-600 hover:text-sky-700 hover:bg-white/80 text-sm font-extrabold transition-colors"
                          >
                            Entregar
                          </button>
                          <button
                            type="button"
                            className="h-10 px-6 rounded-xl bg-white text-slate-900 shadow-sm border border-slate-200 text-sm font-extrabold"
                            aria-current="page"
                          >
                            Retirar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Estado: Validando */}
              {status === 'validando' && !kioskSenhaMostrarUI && (
                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 text-sky-500 animate-spin mx-auto mb-4" />
                  <p className="text-lg text-gray-600">{mensagem}</p>
                </div>
              )}

              {/* Estado: Abrindo */}
              {status === 'abrindo' && !kioskSenhaMostrarUI && (
                <div className="text-center py-8">
                  <div className="relative inline-block">
                    <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <p className="text-lg text-gray-600 mt-4">{mensagem}</p>
                </div>
              )}

              {/* Estado: Aberta */}
              {(status === 'aberta' || status === 'aguardando_fechar') && (
                <div className="text-center py-6">
                  {/* Ícone animado */}
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4 animate-pulse">
                    <DoorOpen className="w-12 h-12 text-green-600" />
                  </div>
                  
                  <h3 className="text-3xl font-bold text-green-600 mb-2">Porta Aberta!</h3>
                  <p className="text-gray-600 mb-2">Retire sua encomenda</p>
                  
                  {/* Lembrete do destino */}
                  {portaInfo && (
                    <div className="inline-flex items-center gap-2 bg-sky-50 text-sky-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                      <span>Bloco {portaInfo.bloco}</span>
                      <span>•</span>
                      <span>Apto {portaInfo.apartamento}</span>
                    </div>
                  )}
                  
                  {tempoRestante > 0 && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-4">
                      <div className="text-sm text-gray-500 mb-1">Tempo para retirada</div>
                      <div className="text-5xl font-bold text-sky-700 mb-2">{tempoRestante}s</div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-1000 ${
                            tempoRestante <= 10 ? 'bg-red-500' : tempoRestante <= 20 ? 'bg-amber-500' : 'bg-sky-600'
                          }`}
                          style={{ width: `${(tempoRestante / 30) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={resetar}
                    className="mt-6 px-8 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Nova Retirada
                  </button>
                </div>
              )}
            </div>

            {showKioskKeypad && (
              <div className="p-6 bg-slate-50/70 flex flex-col items-center justify-center">
                <div className="w-full max-w-[320px]">
                  <div className="grid grid-cols-3 gap-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={kioskSenhaProcessando}
                        onClick={() => keypadDigit(d)}
                        className={`h-14 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 text-xl font-extrabold border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-200 select-none disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center leading-none ${kioskSenhaProcessando ? 'pointer-events-none' : ''}`}
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={kioskSenhaProcessando}
                      onClick={keypadBackspace}
                      className={`h-14 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-200 select-none disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center leading-none ${kioskSenhaProcessando ? 'pointer-events-none' : ''}`}
                    >
                      Apagar
                    </button>
                    <button
                      type="button"
                      disabled={kioskSenhaProcessando}
                      onClick={() => keypadDigit('0')}
                      className={`h-14 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 text-xl font-extrabold border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-200 select-none disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center leading-none ${kioskSenhaProcessando ? 'pointer-events-none' : ''}`}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={kioskSenhaProcessando}
                      onClick={keypadClear}
                      className={`h-14 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-200 select-none disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center leading-none ${kioskSenhaProcessando ? 'pointer-events-none' : ''}`}
                    >
                      Limpar
                    </button>
                  </div>

                  {isKiosk && metodo === 'senha' && (
                    <button
                      type="button"
                      onClick={validarSenha}
                      disabled={senha.length < 4 || kioskSenhaProcessando}
                      className="mt-4 w-full h-11 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 text-white text-sm font-extrabold hover:from-sky-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-200 flex items-center justify-center gap-2"
                    >
                      {kioskSenhaProcessando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                      {status === 'validando' ? 'Validando...' : status === 'abrindo' ? 'Abrindo...' : 'Abrir Porta'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {mensagem && status === 'erro' && (
        <div className="fixed right-6 top-6 z-50 w-[min(420px,calc(100vw-2rem))]">
          <div
            role="alert"
            className="pointer-events-none rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg"
          >
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold">{mensagem}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
