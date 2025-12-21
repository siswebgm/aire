import { useState, useEffect, useRef } from 'react'
import { DoorOpen, DoorClosed, Activity, AlertCircle, CheckCircle2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import type { Porta } from '../types/gaveteiro'

// Usar proxy do Vite (mesma porta 3000)
const ESP32_PROXY_URL = '/esp32'

type EstadoPorta = 'aberta' | 'fechada' | 'desconhecido'
type EstadoSensor = 'fechado' | 'aberto' | 'desconhecido'

interface PortaStatus {
  uid: string
  gaveteiro_uid: string
  numero: number
  fechadura: EstadoPorta
  sensor: EstadoSensor
  gpio_rele: number
  gpio_sensor: number
  loading: boolean
}

export default function Esp32TestePage() {
  const { condominio } = useAuth()
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [portas, setPortas] = useState<PortaStatus[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(24)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [esp32Online, setEsp32Online] = useState<boolean | null>(null)
  const [uptime, setUptime] = useState<number>(0)
  const [wifiRssi, setWifiRssi] = useState<number>(0)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(2000) // 2 segundos

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadPortasDisponiveis = async () => {
    if (!condominio?.uid) return

    const { data: portasDb, error: portasErr } = await supabase
      .from('gvt_portas')
      .select('*')
      .eq('condominio_uid', condominio.uid)
      .eq('ativo', true)
      .order('gaveteiro_uid', { ascending: true })
      .order('numero_porta', { ascending: true })

    if (portasErr) {
      console.error('Erro ao listar portas:', portasErr)
      setError('Erro ao carregar portas disponíveis')
      return
    }

    const portasLista = (portasDb || []) as Porta[]
    setPortas(prev => {
      const prevByUid = new Map(prev.map(p => [p.uid, p]))
      return portasLista.map((p) => {
        const existing = prevByUid.get(p.uid)
        return {
          uid: p.uid,
          gaveteiro_uid: p.gaveteiro_uid,
          numero: p.numero_porta,
          fechadura: (p.fechadura_status ?? existing?.fechadura ?? 'desconhecido') as EstadoPorta,
          sensor: (p.sensor_ima_status ?? p.sensor_status ?? existing?.sensor ?? 'desconhecido') as EstadoSensor,
          gpio_rele: existing?.gpio_rele ?? 0,
          gpio_sensor: existing?.gpio_sensor ?? 0,
          loading: false
        }
      })
    })

    setPage(1)
  }

  useEffect(() => {
    loadPortasDisponiveis()
  }, [condominio?.uid])

  // Carregar status ao montar e auto-refresh
  useEffect(() => {
    testStatus()

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        testStatusSilent() // Atualiza sem mostrar loading
      }, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh, refreshInterval])

  const testStatus = async () => {
    setLoadingStatus(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`${ESP32_PROXY_URL}/status`, { method: 'GET' })
      const txt = await res.text()
      setResult(txt)
      
      // Tentar parsear JSON
      try {
        const data = JSON.parse(txt)
        setEsp32Online(true)
        setUptime(data.uptime || 0)
        setWifiRssi(data.wifi_rssi || 0)
        
        if (data.portas && Array.isArray(data.portas)) {
          const porNumero = new Map<number, any>()
          for (const item of data.portas) {
            const numero = Number(item?.numero ?? item?.porta)
            if (Number.isFinite(numero)) porNumero.set(numero, item)
          }

          setPortas(prev => prev.map((p) => {
            const item = porNumero.get(p.numero)
            if (!item) return p

            const fechadura = (item?.fechadura ?? p.fechadura) as EstadoPorta
            const estadoSensor = String(item?.sensor ?? item?.estado ?? '').toLowerCase()
            const sensor = (estadoSensor === 'fechada' || estadoSensor === 'fechado')
              ? 'fechado'
              : (estadoSensor ? 'aberto' : p.sensor)

            return {
              ...p,
              fechadura,
              sensor,
              gpio_rele: item?.gpio_rele ?? p.gpio_rele,
              gpio_sensor: item?.gpio_sensor ?? p.gpio_sensor
            }
          }))
        }
        setSuccess('Status atualizado!')
      } catch {
        // Resposta não é JSON válido
        setEsp32Online(true)
      }
    } catch (e: any) {
      setError(e?.message || 'Falha ao obter status')
      setEsp32Online(false)
    } finally {
      setLoadingStatus(false)
    }
  }

  // Atualização silenciosa (sem loading) para auto-refresh
  const testStatusSilent = async () => {
    try {
      const res = await fetch(`${ESP32_PROXY_URL}/status`, { method: 'GET' })
      const txt = await res.text()
      
      try {
        const data = JSON.parse(txt)
        setEsp32Online(true)
        setUptime(data.uptime || 0)
        setWifiRssi(data.wifi_rssi || 0)
        
        if (data.portas && Array.isArray(data.portas)) {
          const porNumero = new Map<number, any>()
          for (const item of data.portas) {
            const numero = Number(item?.numero ?? item?.porta)
            if (Number.isFinite(numero)) porNumero.set(numero, item)
          }

          setPortas(prev => prev.map((p) => {
            const item = porNumero.get(p.numero)
            if (!item) return p

            const fechadura = (item?.fechadura ?? p.fechadura) as EstadoPorta
            const estadoSensor = String(item?.sensor ?? item?.estado ?? '').toLowerCase()
            const sensor = (estadoSensor === 'fechada' || estadoSensor === 'fechado')
              ? 'fechado'
              : (estadoSensor ? 'aberto' : p.sensor)

            return {
              ...p,
              fechadura,
              sensor,
              gpio_rele: item?.gpio_rele ?? p.gpio_rele,
              gpio_sensor: item?.gpio_sensor ?? p.gpio_sensor
            }
          }))
        }
      } catch {
        setEsp32Online(true)
      }
    } catch {
      setEsp32Online(false)
    }
  }

  const abrirPorta = async (porta: PortaStatus) => {
    setPortas(prev => prev.map(p => 
      p.uid === porta.uid ? { ...p, loading: true } : p
    ))
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`${ESP32_PROXY_URL}/abrir?porta=${porta.numero}`, { 
        method: 'GET'
      })
      const txt = await res.text()
      setResult(txt)
      
      if (res.ok) {
        setPortas(prev => prev.map(p => 
          p.uid === porta.uid ? { ...p, fechadura: 'aberta', loading: false } : p
        ))
        setSuccess(`🔓 Porta ${porta.numero} ABERTA!`)
        setTimeout(() => {
          testStatusSilent()
        }, 350)
      } else {
        setError(txt)
        setPortas(prev => prev.map(p => 
          p.uid === porta.uid ? { ...p, loading: false } : p
        ))
      }
    } catch (e: any) {
      setError(e?.message || 'Falha ao abrir')
      setPortas(prev => prev.map(p => 
        p.uid === porta.uid ? { ...p, loading: false } : p
      ))
    }
  }

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  const totalPages = Math.max(1, Math.ceil(portas.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const portasPagina = portas.slice(startIndex, startIndex + pageSize)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                <DoorOpen size={20} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold">Teste de Integração ESP32</h1>
                <p className="text-white/90 text-sm">Controle multi-porta via ESP32</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Indicador de tempo real */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                autoRefresh ? 'bg-green-500/30 text-green-100' : 'bg-gray-500/30 text-gray-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                {autoRefresh ? 'Tempo Real' : 'Pausado'}
              </div>
              
              {/* Toggle Auto-Refresh */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                  autoRefresh 
                    ? 'bg-orange-500/30 hover:bg-orange-500/40 text-orange-100' 
                    : 'bg-green-500/30 hover:bg-green-500/40 text-green-100'
                }`}
              >
                {autoRefresh ? '⏸ Pausar' : '▶ Iniciar'}
              </button>
              
              {/* Botão Atualizar Manual */}
              <button
                onClick={testStatus}
                disabled={loadingStatus}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
              >
                <RefreshCw size={18} className={loadingStatus ? 'animate-spin' : ''} />
                <span className="text-sm font-medium">Atualizar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Status do ESP32 */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Conexão */}
            <div className={`p-4 rounded-xl border-2 ${
              esp32Online === true ? 'bg-green-50 border-green-200' :
              esp32Online === false ? 'bg-red-50 border-red-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {esp32Online ? <Wifi size={18} className="text-green-600" /> : <WifiOff size={18} className="text-red-600" />}
                <span className="text-sm font-semibold text-gray-700">Conexão</span>
              </div>
              <p className={`text-lg font-bold ${esp32Online ? 'text-green-700' : 'text-red-700'}`}>
                {esp32Online === true ? 'Online' : esp32Online === false ? 'Offline' : 'Verificando...'}
              </p>
            </div>

            {/* IP */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-sm font-semibold text-gray-500 mb-1">ESP32 IP</p>
              <p className="text-lg font-bold text-gray-800">192.168.1.73</p>
            </div>

            {/* Uptime */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-sm font-semibold text-gray-500 mb-1">Uptime</p>
              <p className="text-lg font-bold text-gray-800">{formatUptime(uptime)}</p>
            </div>

            {/* WiFi Signal */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-sm font-semibold text-gray-500 mb-1">Sinal WiFi</p>
              <p className={`text-lg font-bold ${
                wifiRssi > -50 ? 'text-green-600' : wifiRssi > -70 ? 'text-amber-600' : 'text-red-600'
              }`}>{wifiRssi} dBm</p>
            </div>
          </div>

          {/* Grid de Portas */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Activity size={20} className="text-indigo-600" />
              Controle de Portas ({portas.length} portas)
            </h2>

            <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Página</span>
                <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className={`px-3 py-1 rounded-md text-sm font-bold ${
                      currentPage <= 1
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    Anterior
                  </button>
                  <span className="text-sm font-bold text-gray-800">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className={`px-3 py-1 rounded-md text-sm font-bold ${
                      currentPage >= totalPages
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    Próxima
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Por página</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    setPageSize(Number.isFinite(next) && next > 0 ? next : 24)
                    setPage(1)
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={36}>36</option>
                  <option value={48}>48</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {portasPagina.map((porta) => (
                <div 
                  key={porta.uid}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    porta.fechadura === 'aberta' ? 'bg-green-50 border-green-300' :
                    porta.fechadura === 'fechada' ? 'bg-gray-50 border-gray-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Header da Porta */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        porta.fechadura === 'aberta' ? 'bg-green-500' : 'bg-gray-400'
                      }`}>
                        {porta.fechadura === 'aberta' ? 
                          <DoorOpen size={20} className="text-white" /> : 
                          <DoorClosed size={20} className="text-white" />
                        }
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">Porta {porta.numero}</p>
                        <p className="text-xs text-gray-500">GPIO {porta.gpio_rele}</p>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${
                      porta.fechadura === 'aberta' ? 'bg-green-500' : 
                      porta.fechadura === 'fechada' ? 'bg-gray-400' : 'bg-amber-500'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      porta.fechadura === 'aberta' ? 'text-green-700' : 
                      porta.fechadura === 'fechada' ? 'text-gray-600' : 'text-amber-600'
                    }`}>
                      Fechadura: {porta.fechadura}
                    </span>
                  </div>

                  {/* Estado da Porta Física (baseado no sensor) */}
                  <div className={`p-2 rounded-lg mb-4 ${
                    porta.sensor === 'fechado' 
                      ? 'bg-blue-100 border border-blue-300' 
                      : porta.sensor === 'aberto'
                        ? 'bg-amber-100 border border-amber-300'
                        : 'bg-gray-100 border border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        porta.sensor === 'fechado' ? 'bg-blue-500' : 
                        porta.sensor === 'aberto' ? 'bg-amber-500' : 'bg-gray-400'
                      }`}></div>
                      <span className={`text-sm font-semibold ${
                        porta.sensor === 'fechado' ? 'text-blue-700' : 
                        porta.sensor === 'aberto' ? 'text-amber-700' : 'text-gray-600'
                      }`}>
                        Porta: {porta.sensor === 'fechado' ? 'FECHADA' : porta.sensor === 'aberto' ? 'ABERTA' : '?'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Sensor GPIO {porta.gpio_sensor} ({porta.sensor === 'fechado' ? 'ímã encostado' : 'ímã afastado'})
                    </p>
                  </div>

                  {/* Botões */}
                  <div>
                    <button
                      onClick={() => {
                        if (porta.loading) return
                        abrirPorta(porta)
                      }}
                      disabled={porta.loading}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        porta.loading
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {porta.loading ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <DoorOpen size={14} />
                      )}
                      <span>
                        {porta.loading ? 'Aguarde…' : 'Testar fechadura'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mensagem de Sucesso */}
          {success && (
            <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle2 size={24} className="text-green-600" />
              <p className="font-semibold text-green-800">{success}</p>
            </div>
          )}

          {/* Mensagem de Erro */}
          {error && (
            <div className="mb-4 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
              <AlertCircle size={24} className="text-rose-600 shrink-0" />
              <div>
                <p className="font-bold text-rose-800">Erro</p>
                <p className="text-rose-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Resposta do ESP32 */}
          {result && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Resposta do ESP32 (JSON)</p>
              <pre className="w-full overflow-auto bg-gray-900 text-gray-100 rounded-xl p-4 text-xs max-h-48">
{(() => {
  try {
    return JSON.stringify(JSON.parse(result), null, 2)
  } catch {
    return result
  }
})()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
