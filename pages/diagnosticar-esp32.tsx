import { useState } from 'react'
import Head from 'next/head'

interface ESPTestResult {
  ip: string
  online: boolean
  latency?: number
  error?: string
}

export default function DiagnosticarESP32() {
  const [ipList, setIpList] = useState('192.168.1.100\n192.168.4.1\n192.168.0.100')
  const [results, setResults] = useState<ESPTestResult[]>([])
  const [testing, setTesting] = useState(false)

  const testarIPs = async () => {
    setTesting(true)
    setResults([])

    const ips = ipList.split('\n').map(ip => ip.trim()).filter(ip => ip)
    
    const testPromises = ips.map(async (ip): Promise<ESPTestResult> => {
      const startTime = Date.now()
      
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`http://${ip}/status`, {
          method: 'GET',
          signal: controller.signal,
          mode: 'no-cors'
        })

        clearTimeout(timeoutId)
        const latency = Date.now() - startTime

        return {
          ip,
          online: true,
          latency
        }
      } catch (error) {
        const latency = Date.now() - startTime
        let errorMessage = 'Offline'
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMessage = 'Timeout (5s)'
          } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Não encontrado'
          } else {
            errorMessage = error.message
          }
        }

        return {
          ip,
          online: false,
          latency,
          error: errorMessage
        }
      }
    })

    const testResults = await Promise.all(testPromises)
    setResults(testResults)
    setTesting(false)
  }

  const getStatusColor = (result: ESPTestResult) => {
    if (result.online) {
      if (result.latency && result.latency < 100) return 'text-green-600'
      if (result.latency && result.latency < 500) return 'text-yellow-600'
      return 'text-orange-600'
    }
    return 'text-red-600'
  }

  const getStatusIcon = (result: ESPTestResult) => {
    if (result.online) {
      return (
        <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    }
    return (
      <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    )
  }

  return (
    <>
      <Head>
        <title>Diagnosticar ESP32 - AIRE</title>
        <meta name="description" content="Diagnosticar conexão com dispositivos ESP32" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Diagnosticar ESP32</h1>
            <p className="mt-2 text-gray-600">
              Teste conectividade com múltiplos dispositivos ESP32
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Configuração */}
            <div className="mb-6">
              <label htmlFor="ipList" className="block text-sm font-medium text-gray-700 mb-2">
                Lista de IPs para testar (um por linha)
              </label>
              <textarea
                id="ipList"
                value={ipList}
                onChange={(e) => setIpList(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="192.168.1.100&#10;192.168.4.1&#10;192.168.0.100"
              />
            </div>

            {/* Botão de teste */}
            <div className="flex justify-center mb-6">
              <button
                onClick={testarIPs}
                disabled={testing}
                className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {testing ? 'Testando...' : 'Iniciar Diagnóstico'}
              </button>
            </div>

            {/* Resultados */}
            {results.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Resultados:</h3>
                
                <div className="grid gap-4">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${
                        result.online ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(result)}
                          <div>
                            <p className="font-medium text-gray-900">{result.ip}</p>
                            <p className={`text-sm ${getStatusColor(result)}`}>
                              {result.online ? 'Online' : result.error}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {result.latency && (
                            <p className="text-sm text-gray-600">
                              {result.latency}ms
                            </p>
                          )}
                          {result.online && (
                            <a
                              href={`http://${result.ip}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Abrir →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumo */}
                <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {results.filter(r => r.online).length}
                      </p>
                      <p className="text-sm text-gray-600">Online</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {results.filter(r => !r.online).length}
                      </p>
                      <p className="text-sm text-gray-600">Offline</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-600">
                        {results.length}
                      </p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Instruções */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Dicas de diagnóstico:</h3>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>Verifique se os ESPs estão na mesma rede que você</li>
                <li>Teste IPs comuns: 192.168.1.x, 192.168.0.x, 192.168.4.1</li>
                <li>Para modo AP, use 192.168.4.1</li>
                <li>Latência &lt; 100ms = Excelte, 100-500ms = Bom, &gt; 500ms = Ruim</li>
                <li>Se um ESP estiver online, clique no link para acessar a interface</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
