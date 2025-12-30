import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function ConfigurarESP32() {
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [espIP, setEspIP] = useState('192.168.4.1')
  const [armarioIP, setArmarioIP] = useState('192.168.1.76')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; exactURL?: string } | null>(null)
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string; exactURL?: string } | null>(null)
  const [gaveteiroStatus, setGaveteiroStatus] = useState<{ modo: string; ip: string } | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [currentNetwork, setCurrentNetwork] = useState<string>('')
  const [statusResponse, setStatusResponse] = useState<string>('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<'config' | 'reset' | 'test'>('config')
  
  // Estados para testes
  const [testandoGaveteiros, setTestandoGaveteiros] = useState(false)
  const [portasDisponiveis, setPortasDisponiveis] = useState<any[]>([])
  const [carregandoPortas, setCarregandoPortas] = useState(false)
  const [portaAbertura, setPortaAbertura] = useState<string | null>(null)
  const [condominioInfo, setCondominioInfo] = useState<any>(null)
  const [usuarioInfo, setUsuarioInfo] = useState<any>(null)

  const router = useRouter()

  // Detectar rede WiFi atual ao carregar a página
  React.useEffect(() => {
    const detectCurrentNetwork = async () => {
      try {
        // Usar a API Network Information se disponível
        if ('connection' in navigator) {
          const connection = (navigator as any).connection
          if (connection && connection.type === 'wifi') {
            // Tentar obter informações da rede
            const networkInfo = {
              type: connection.type,
              effectiveType: connection.effectiveType,
              downlink: connection.downlink,
              rtt: connection.rtt
            }
            console.log('Informações da rede:', networkInfo)
            
            // Para obter o SSID, precisaríamos de uma API diferente ou backend
            // Por enquanto, vamos apenas indicar que estamos em WiFi
            setCurrentNetwork('WiFi detectado')
          }
        }

        // Tentar usar uma abordagem alternativa para detectar o nome da rede
        // Nota: Por questões de segurança, o navegador não expõe o SSID diretamente
        // Mas podemos tentar detectar se estamos em uma rede conhecida pelo IP
        
      } catch (error) {
        console.log('Não foi possível detectar informações da rede')
      }
    }

    detectCurrentNetwork()
  }, [])

  // Carregar informações do condomínio e usuário
  React.useEffect(() => {
    const carregarInformacoes = async () => {
      try {
        const condominioUid = localStorage.getItem('condominio_uid') || '7642e477-4b26-4064-8625-526ecb5e334a'
        const usuarioUid = localStorage.getItem('usuario_uid')
        
        // Buscar informações do condomínio sem abrir portas
        try {
          const condominioResponse = await fetch('/api/proxy/buscar-condominio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ condominioUid })
          })
          
          if (condominioResponse.ok) {
            const condominioData = await condominioResponse.json()
            setCondominioInfo({
              nome: condominioData.nome || 'Condomínio não identificado',
              esp32Ip: condominioData.esp32Ip || '192.168.1.76'
            })
          }
        } catch (error) {
          console.log('Erro ao buscar condomínio, usando valores padrão')
          setCondominioInfo({
            nome: 'Condomínio não identificado',
            esp32Ip: '192.168.1.76'
          })
        }
        
        // Buscar informações do usuário (se disponível)
        if (usuarioUid) {
          setUsuarioInfo({
            uid: usuarioUid,
            nome: localStorage.getItem('usuario_nome') || 'Usuário'
          })
        }
        
      } catch (error) {
        console.error('Erro ao carregar informações:', error)
        // Valores padrão
        setCondominioInfo({
          nome: 'Condomínio não identificado',
          esp32Ip: '192.168.1.76'
        })
      }
    }
    
    carregarInformacoes()
  }, [])

  // Carregar portas automaticamente quando a aba de testes for selecionada (apenas lista, sem abrir)
  React.useEffect(() => {
    if (activeTab === 'test') {
      carregarListaPortas()
    }
  }, [activeTab])

  const carregarListaPortas = async () => {
    setCarregandoPortas(true)
    setPortasDisponiveis([])
    
    try {
      // Obter o UID do condomínio
      const condominioUid = localStorage.getItem('condominio_uid') || '7642e477-4b26-4064-8625-526ecb5e334a'
      
      // Buscar portas do condomínio (apenas lista, sem abrir)
      const response = await fetch('/api/buscar-portas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          condominioUid: condominioUid
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar portas')
      }

      // Carregar portas sem tentar abrir nenhuma
      setPortasDisponiveis(data.resultados || [])
      
    } catch (error: any) {
      console.error('Erro ao buscar portas:', error)
      setResult({
        success: false,
        message: error.message || 'Erro ao buscar portas'
      })
    } finally {
      setCarregandoPortas(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!ssid || !password) {
      setResult({ success: false, message: 'Preencha SSID e senha do WiFi' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      // Usar proxy server-side para evitar CORS
      const response = await fetch('/api/proxy/config-wifi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ssid: ssid,
          password: password,
          espIP: espIP
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao configurar WiFi')
      }

      setResult({ 
        success: true, 
        message: formatESP32Message(data.message) || 'Configuração enviada com sucesso!',
        exactURL: data.exactURL
      })

      // Limpar formulário
      setSsid('')
      setPassword('')

    } catch (error) {
      console.error('Erro ao configurar WiFi:', error)
      setResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao conectar ao ESP32' 
      })
    } finally {
      setLoading(false)
    }
  }

  const testarConexao = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch(`http://${espIP}/`, {
        method: 'GET',
        mode: 'no-cors'
      })

      setResult({ 
        success: true, 
        message: 'ESP32 online e respondendo!' 
      })

    } catch (error) {
      setResult({ 
        success: false, 
        message: 'ESP32 não encontrado. Verifique o IP e a conexão.' 
      })
    } finally {
      setLoading(false)
    }
  }

  const verificarStatusGaveteiro = async () => {
    setCheckingStatus(true)
    setGaveteiroStatus(null)
    setStatusResponse('')

    try {
      // Usar proxy para verificar status do gaveteiro
      const response = await fetch('/api/proxy/status-gaveteiro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          armarioIP: armarioIP
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || `Erro HTTP ${response.status}: ${response.statusText}`
        throw new Error(errorMessage)
      }

      // Mostrar a resposta bruta do gaveteiro
      setStatusResponse(data.armarioResponse || 'Sem resposta')

      if (data.parsedResponse && data.parsedResponse.modo === 'wifi') {
        setGaveteiroStatus({
          modo: data.parsedResponse.modo,
          ip: data.parsedResponse.ip
        })
        setResult({ 
          success: true, 
          message: `Gaveteiro conectado ao WiFi! IP: ${data.parsedResponse.ip}` 
        })
      } else {
        setGaveteiroStatus(null)
        setResult({ 
          success: false, 
          message: 'Gaveteiro não encontrado ou não está conectado ao WiFi' 
        })
      }

    } catch (error) {
      console.error('Erro ao verificar status:', error)
      setGaveteiroStatus(null)
      
      let errorMessage = 'Não foi possível conectar ao gaveteiro. Verifique se está na mesma rede.'
      
      // Tratar especificamente erro de abort (timeout)
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Timeout na comunicação com o gaveteiro. Verifique se o IP está correto e se o dispositivo está online.'
          setStatusResponse('Timeout - Sem resposta do gaveteiro')
        } else {
          errorMessage = error.message
          setStatusResponse(`Erro: ${error.message}`)
        }
      } else {
        setStatusResponse('Erro desconhecido na comunicação')
      }
      
      setResult({ 
        success: false, 
        message: errorMessage
      })
    } finally {
      setCheckingStatus(false)
    }
  }

  const resetarWiFi = async () => {
    setLoading(true)
    setResult(null)
    setResetResult(null)
    setShowResetConfirm(false)

    try {
      // Token privado fixo (em produção, deveria vir de variável de ambiente)
      const RESET_TOKEN = '8433135'
      
      // Usar proxy server-side para evitar CORS
      const response = await fetch('/api/proxy/reset-wifi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          armarioIP: armarioIP,
          token: RESET_TOKEN
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao resetar WiFi')
      }

      setResetResult({ 
        success: true, 
        message: formatESP32Message(data.message) || 'WiFi do armário resetado com sucesso!',
        exactURL: data.exactURL
      })

    } catch (error) {
      console.error('Erro ao resetar WiFi:', error)
      setResetResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao comunicar com o armário' 
      })
    } finally {
      setLoading(false)
    }
  }

  // Função auxiliar para formatar mensagens do ESP32
  const formatESP32Message = (message: string) => {
    const messageMap: { [key: string]: string } = {
      'wifi_salvo_reiniciando': 'WiFi salvo com sucesso! O ESP32 está reiniciando...',
      'wifi_resetado_reiniciando': 'WiFi resetado com sucesso! O armário está reiniciando...',
      'config_wifi_sucesso': 'Configuração WiFi enviada com sucesso!',
      'reset_wifi_sucesso': 'Reset WiFi executado com sucesso!'
    }
    
    return messageMap[message] || message
  }
  const getCurlCommand = () => {
    const encodedSSID = encodeURIComponent(ssid || 'SEU_WIFI')
    const encodedPassword = password ? 'SUA_SENHA' : ''
    return `curl "http://${espIP}/config-wifi?ssid=${encodedSSID}&password=${encodedPassword}"`
  }

  const getResetCurlCommand = () => {
    return `curl "http://${armarioIP}/reset-wifi?token=8433135"`
  }

  const testarGaveteiros = async () => {
    // Esta função não é mais usada, mantida para compatibilidade
    await carregarListaPortas()
  }

  const abrirPortaIndividual = async (porta: any) => {
    setPortaAbertura(porta.portaUid)
    
    try {
      const condominioUid = localStorage.getItem('condominio_uid') || '7642e477-4b26-4064-8625-526ecb5e334a'
      
      // Usar proxy para evitar CORS
      const response = await fetch('/api/proxy/abrir-porta-individual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          condominioUid: condominioUid,
          portaUid: porta.portaUid,
          porta: porta.porta
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao abrir porta')
      }

      // Atualizar status da porta na lista
      setPortasDisponiveis(prev => prev.map(p => 
        p.porta === porta.porta 
          ? { ...p, sucesso: data.success, resposta: data.esp32Response, url: data.esp32Url, erro: data.success ? null : data.error }
          : p
      ))

      setResult({
        success: data.success,
        message: data.message || (data.success ? `Porta ${porta.porta} aberta com sucesso!` : `Falha ao abrir porta ${porta.porta}`)
      })

    } catch (error: any) {
      console.error(`Erro ao abrir porta ${porta.porta}:`, error)
      
      // Atualizar status com erro
      setPortasDisponiveis(prev => prev.map(p => 
        p.porta === porta.porta 
          ? { ...p, sucesso: false, erro: error.message || 'Erro de conexão' }
          : p
      ))
      
      setResult({
        success: false,
        message: `Erro ao abrir porta ${porta.porta}: ${error.message}`
      })
    } finally {
      setPortaAbertura(null)
    }
  }

  return (
    <>
      <Head>
        <title>Configurar ESP32 - AIRE</title>
        <meta name="description" content="Configurar WiFi do ESP32" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Configurar ESP32</h1>
            <p className="mt-2 text-gray-600">
              Configure o WiFi do seu dispositivo ESP32
            </p>
          </div>

          {/* Abas */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-2 px-4 text-center font-medium ${
                activeTab === 'config'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Configurar WiFi
            </button>
            <button
              onClick={() => setActiveTab('reset')}
              className={`flex-1 py-2 px-4 text-center font-medium ${
                activeTab === 'reset'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Resetar WiFi
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`flex-1 py-2 px-4 text-center font-medium ${
                activeTab === 'test'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Testar Gaveteiros
            </button>
          </div>

          {/* Conteúdo da aba Configurar */}
          {activeTab === 'config' && (
            <>
              {/* Alerta de segurança */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Modo AP do ESP32
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>O ESP32 deve estar em modo Access Point (AP) com IP padrão 192.168.4.1</p>
                      <p className="mt-1">Conecte-se à rede WiFi "ESP32-AP" antes de configurar.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Indicador de rede atual */}
              {currentNetwork && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1v0a1 1 0 110 2v0a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-800">
                        {currentNetwork} - Verifique se está em uma rede 2.4GHz para melhor compatibilidade com ESP32
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulário de configuração */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* IP do ESP32 */}
                <div>
                  <label htmlFor="espIP" className="block text-sm font-medium text-gray-700">
                    IP do ESP32
                  </label>
                  <input
                    type="text"
                    id="espIP"
                    value={espIP}
                    onChange={(e) => setEspIP(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="192.168.4.1"
                    required
                  />
                </div>

                {/* Botão de teste */}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={testarConexao}
                    disabled={loading}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                  >
                    {loading ? 'Testando...' : 'Testar Conexão'}
                  </button>
                  <button
                    type="button"
                    onClick={verificarStatusGaveteiro}
                    disabled={checkingStatus}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {checkingStatus ? 'Verificando...' : 'Verificar Gaveteiro'}
                  </button>
                </div>

                {/* Status do gaveteiro */}
                {gaveteiroStatus && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-800">
                          Gaveteiro conectado! Modo: {gaveteiroStatus.modo.toUpperCase()} | IP: {gaveteiroStatus.ip}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resposta bruta do status */}
                {statusResponse && (
                  <div className="bg-gray-100 border border-gray-300 rounded-md p-3">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">URL Chamada:</h4>
                    <code className="text-xs text-gray-600 block mb-2">
                      curl "http://{armarioIP}/status"
                    </code>
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Resposta do Gaveteiro:</h4>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                      {statusResponse}
                    </pre>
                  </div>
                )}

                {/* SSID */}
                <div>
                  <label htmlFor="ssid" className="block text-sm font-medium text-gray-700">
                    Nome da Rede WiFi (SSID)
                  </label>
                  <input
                    type="text"
                    id="ssid"
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nome da Rede WiFi (SSID) - Prefira redes 2.4GHz (2G)"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    ESP32 funciona melhor com redes 2.4GHz. Redes 5GHz podem não ser compatíveis.
                  </p>
                </div>

                {/* Senha */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Senha do WiFi
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="SUA_SENHA_WIFI"
                    required
                  />
                </div>

                {/* Botão de envio */}
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Configurar WiFi'}
                  </button>
                </div>
              </form>

              {/* Comando curl equivalente */}
              <div className="mt-6 bg-gray-100 rounded-md p-4">
                <h3 className="text-sm font-medium text-gray-800 mb-2">
                  {result?.success && result.exactURL ? 'URL exata enviada:' : 'Comando equivalente (curl):'}
                </h3>
                <code className="text-xs text-gray-600 block">
                  {result?.success && result.exactURL 
                    ? `curl "${result.exactURL}"`
                    : getCurlCommand()
                  }
                </code>
              </div>
            </>
          )}

          {/* Conteúdo da aba Reset */}
          {activeTab === 'reset' && (
            <>
              {/* Alerta de segurança */}
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Atenção: Reset de WiFi
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>Esta operação irá resetar as configurações de WiFi do armário conectado.</p>
                      <p className="mt-1">O armário voltará ao modo Access Point após o reset.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulário de reset */}
              <div className="space-y-6">
                {/* IP do Armário */}
                <div>
                  <label htmlFor="armarioIP" className="block text-sm font-medium text-gray-700">
                    IP do Armário
                  </label>
                  <input
                    type="text"
                    id="armarioIP"
                    value={armarioIP}
                    onChange={(e) => setArmarioIP(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="192.168.1.76"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    IP do armário já conectado à sua rede WiFi
                  </p>
                </div>

                {/* Botão de reset */}
                <div>
                  {!showResetConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={loading}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      Resetar WiFi do Armário
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-red-100 border border-red-300 rounded-md p-3">
                        <p className="text-sm text-red-800 font-medium mb-2">
                          Confirmar reset de WiFi?
                        </p>
                        <p className="text-xs text-red-700 mb-3">
                          Esta ação não pode ser desfeita. O armário será desconectado da rede WiFi atual.
                        </p>
                        <div className="flex space-x-3">
                          <button
                            type="button"
                            onClick={resetarWiFi}
                            disabled={loading}
                            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                          >
                            {loading ? 'Resetando...' : 'Confirmar Reset'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowResetConfirm(false)}
                            disabled={loading}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comando curl equivalente */}
                <div className="mt-6 bg-gray-100 rounded-md p-4">
                  <h3 className="text-sm font-medium text-gray-800 mb-2">
                    {resetResult?.success && resetResult.exactURL ? 'URL exata enviada:' : 'Comando equivalente (curl):'}
                  </h3>
                  <code className="text-xs text-gray-600 block">
                    {resetResult?.success && resetResult.exactURL 
                      ? `curl "${resetResult.exactURL}"`
                      : getResetCurlCommand()
                    }
                  </code>
                </div>

                {/* Resultado do reset */}
                {resetResult && (
                  <div className={`mt-6 p-4 rounded-md ${
                    resetResult.success 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        {resetResult.success ? (
                          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="ml-3">
                        <p className={`text-sm ${
                          resetResult.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {resetResult.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Conteúdo da aba Testar Gaveteiros */}
          {activeTab === 'test' && (
            <>
              {/* Banner com informações */}
              {(condominioInfo || usuarioInfo) && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {condominioInfo && (
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-blue-900">Condomínio</p>
                          <p className="text-sm text-blue-700">{condominioInfo.nome}</p>
                          <p className="text-xs text-blue-600">ESP32: {condominioInfo.esp32Ip}</p>
                        </div>
                      </div>
                    )}
                    {usuarioInfo && (
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-indigo-900">Usuário</p>
                          <p className="text-sm text-indigo-700">{usuarioInfo.nome}</p>
                          <p className="text-xs text-indigo-600">ID: {usuarioInfo.uid.substring(0, 8)}...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de portas */}
              {carregandoPortas ? (
                <div className="border border-gray-200 rounded-lg p-8 text-center">
                  <div className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-gray-600">Carregando portas...</span>
                  </div>
                </div>
              ) : portasDisponiveis.length > 0 ? (
                <div className="border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Portas Disponíveis ({portasDisponiveis.length})
                    </h3>
                    <button
                      onClick={() => {
                        setPortasDisponiveis([])
                        setResult(null)
                      }}
                      className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                      {portasDisponiveis.map((porta: any, index: number) => (
                        <div
                          key={index}
                          className={`border rounded-lg p-4 ${
                            porta.sucesso === true
                              ? 'bg-green-50 border-green-200'
                              : porta.sucesso === false
                              ? 'bg-red-50 border-red-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="text-center mb-3">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${
                              porta.sucesso === true
                                ? 'bg-green-100'
                                : porta.sucesso === false
                                ? 'bg-red-100'
                                : 'bg-gray-100'
                            }`}>
                              <span className={`text-xl font-bold ${
                                porta.sucesso === true
                                  ? 'text-green-800'
                                  : porta.sucesso === false
                                  ? 'text-red-800'
                                  : 'text-gray-800'
                              }`}>
                                {porta.porta}
                              </span>
                            </div>
                            <p className="text-base font-medium text-gray-900">
                              Porta {porta.porta}
                            </p>
                            <p className="text-sm text-gray-500">
                              {porta.gaveteiro}
                            </p>
                            <p className="text-xs text-gray-400">
                              {porta.status}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => abrirPortaIndividual(porta)}
                            disabled={portaAbertura === porta.portaUid}
                            className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              portaAbertura === porta.portaUid
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : porta.sucesso === true
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : porta.sucesso === false
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {portaAbertura === porta.portaUid
                              ? 'Abrindo...'
                              : porta.sucesso === true
                              ? 'Abrir Novamente'
                              : porta.sucesso === false
                              ? 'Tentar Novamente'
                              : 'Abrir Porta'
                            }
                          </button>
                          
                          {/* Detalhes da requisição (sem URL e sem resposta) */}
                          {porta.erro && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div>
                                <p className="text-xs font-medium text-red-700">Erro:</p>
                                <code className="text-xs text-red-600 break-all block bg-red-50 p-1 rounded">
                                  {porta.erro}
                                </code>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                  <p>Nenhuma porta encontrada</p>
                </div>
              )}
            </>
          )}

          {/* Resultado */}
          {result && (
            <div className={`mt-6 p-4 rounded-md ${
              result.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {result.success ? (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instruções */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Instruções:</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Conecte-se à rede WiFi "ESP32-AP"</li>
              <li>Verifique se o IP está correto (padrão: 192.168.4.1)</li>
              <li>Clique em "Testar Conexão" para confirmar</li>
              <li>Preencha SSID e senha da sua rede WiFi</li>
              <li>Clique em "Configurar WiFi"</li>
              <li>Aguarde o ESP32 reiniciar e conectar à sua rede</li>
            </ol>
          </div>

          {/* Comando curl equivalente */}
          <div className="mt-6 bg-gray-100 rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2">Comando equivalente (curl):</h3>
            <code className="text-xs text-gray-600 block">
              curl -X POST http://{espIP}/config-wifi \<br/>
              -d "ssid={ssid || 'SEU_WIFI'}" \<br/>
              -d "password={password ? 'SUA_SENHA' : ''}"
            </code>
          </div>

          {/* Botão voltar */}
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Voltar para o início
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
