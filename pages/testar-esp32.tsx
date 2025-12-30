import { useState, useEffect } from 'react'

interface PortaStatus {
  numero: number
  fechadura: string
  sensor: string
  porta_fisica: string
  gpio_rele: number
  gpio_sensor: number
}

interface StatusGeral {
  portas: PortaStatus[]
  uptime: number
  wifi_rssi: number
}

export default function TesteEsp32Page() {
  const [ip, setIp] = useState('192.168.1.73')
  const [porta, setPorta] = useState('80')
  const [token, setToken] = useState('Bearer teste')
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<StatusGeral | null>(null)
  const [loading, setLoading] = useState(false)

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50))
  }

  const baseUrl = `http://${ip}:${porta}`

  async function chamarEndpoint(endpoint: string, method = 'GET') {
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      })
      const txt = await res.text()
      addLog(`${method} ${endpoint} → ${res.status} ${txt}`)
      return { ok: res.ok, status: res.status, text: txt }
    } catch (err: any) {
      addLog(`ERRO ${endpoint}: ${err.message}`)
      return { ok: false, status: 0, text: err.message }
    } finally {
      setLoading(false)
    }
  }

  async function abrirPorta(num: number) {
    await chamarEndpoint(`/abrir?porta=${num}`)
  }

  async function fecharPorta(num: number) {
    await chamarEndpoint(`/fechar?porta=${num}`)
  }

  async function lerStatus(num?: number) {
    const endpoint = num ? `/status?porta=${num}` : '/status'
    const r = await chamarEndpoint(endpoint)
    if (r.ok) {
      try {
        const data = JSON.parse(r.text)
        if (num) {
          addLog(`Porta ${num}: ${JSON.stringify(data, null, 2)}`)
        } else {
          setStatus(data)
        }
      } catch {}
    }
  }

  async function health() {
    await chamarEndpoint('/health')
  }

  useEffect(() => {
    lerStatus()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Painel de Teste ESP32</h1>

        {/* Configuração */}
        <div className="bg-white rounded shadow p-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="IP"
            value={ip}
            onChange={e => setIp(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Porta"
            value={porta}
            onChange={e => setPorta(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Token"
            value={token}
            onChange={e => setToken(e.target.value)}
          />
          <button
            className="bg-blue-500 text-white rounded px-4 py-1 disabled:opacity-50"
            disabled={loading}
            onClick={health}
          >
            Health
          </button>
        </div>

        {/* Botões rápidos */}
        <div className="bg-white rounded shadow p-4 flex gap-2 flex-wrap">
          <button
            className="bg-green-500 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
            disabled={loading}
            onClick={() => lerStatus()}
          >
            Atualizar Status
          </button>
          <button
            className="bg-gray-500 text-white rounded px-3 py-1 text-sm"
            onClick={() => setLogs([])}
          >
            Limpar Logs
          </button>
        </div>

        {/* Grade de portas */}
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-3">Portas (1-12)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(num => {
              const portaStatus = status?.portas.find(p => p.numero === num)
              return (
                <div key={num} className="border rounded p-2 text-center">
                  <div className="font-bold">Porta {num}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {portaStatus ? (
                      <>
                        <div>Fech: {portaStatus.fechadura}</div>
                        <div>Sens: {portaStatus.sensor}</div>
                      </>
                    ) : (
                      <div>?</div>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2 justify-center">
                    <button
                      className="bg-green-600 text-white text-xs rounded px-2 py-1 disabled:opacity-50"
                      disabled={loading}
                      onClick={() => abrirPorta(num)}
                    >
                      Abrir
                    </button>
                    <button
                      className="bg-red-600 text-white text-xs rounded px-2 py-1 disabled:opacity-50"
                      disabled={loading}
                      onClick={() => fecharPorta(num)}
                    >
                      Fechar
                    </button>
                  </div>
                  <button
                    className="text-xs text-blue-600 underline mt-1 disabled:opacity-50"
                    disabled={loading}
                    onClick={() => lerStatus(num)}
                  >
                    Status
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-3">Logs</h2>
          <pre className="text-xs bg-gray-50 rounded p-2 h-64 overflow-auto whitespace-pre-wrap">
            {logs.length ? logs.join('\n') : '(nenhum log)'}
          </pre>
        </div>
      </div>
    </div>
  )
}
