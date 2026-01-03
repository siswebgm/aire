import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { ArrowLeft, Wifi, RefreshCw, TestTube, Info, Server, Activity, CheckCircle, AlertCircle, Lock, Send } from 'lucide-react'

export default function ConfigurarESP32() {
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [espIP, setEspIP] = useState('192.168.4.1')
  const [armarioIP, setArmarioIP] = useState('')  // ✅ Começa vazio, será preenchido pelo banco
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; exactURL?: string } | null>(null)
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string; exactURL?: string } | null>(null)
  const [gaveteiroStatus, setGaveteiroStatus] = useState<{ modo: string; ip: string } | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [diagnosticando, setDiagnosticando] = useState(false)
  const [diagnostico, setDiagnostico] = useState<{problema: string, solucoes: string[], detalhes: string} | null>(null)
  const [sistemaUrl, setSistemaUrl] = useState('http://app.contatoaire.com')
  const [buscandoIPs, setBuscandoIPs] = useState(false)
  const [ipsEncontrados, setIpsEncontrados] = useState<string[]>([])
  const [testandoIPs, setTestandoIPs] = useState(false)
  const [resultadosTeste, setResultadosTeste] = useState<{ip: string, online: boolean}[]>([])
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
            // ✅ Atualizar armarioIP com o IP do banco de dados
            setArmarioIP(condominioData.esp32Ip || '192.168.1.76')
            console.log(`[CONFIG] IP do condomínio carregado: ${condominioData.esp32Ip || '192.168.1.76'}`)
          }
        } catch (error) {
          console.log('Erro ao buscar condomínio, usando valores padrão')
          setCondominioInfo({
            nome: 'Condomínio não identificado',
            esp32Ip: '192.168.1.76'
          })
          // ✅ Usar IP padrão também em caso de erro
          setArmarioIP('192.168.1.76')
          console.log('[CONFIG] Usando IP padrão devido a erro: 192.168.1.76')
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
        // ✅ Usar IP padrão também no catch final
        setArmarioIP('192.168.1.76')
        console.log('[CONFIG] Usando IP padrão no catch final: 192.168.1.76')
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

  // Função para testar se o sistema está acessível
  const testarConexaoSistema = async (): Promise<boolean> => {
    try {
      setStatusResponse('Testando conexão com o sistema...')
      
      const response = await fetch('/api/proxy/buscar-gaveteiros', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sistemaUrl: sistemaUrl
        })
      })
      
      if (response.ok) {
        setStatusResponse('✅ Sistema acessível!')
        return true
      } else {
        const errorData = await response.json()
        setStatusResponse(`❌ Erro ${response.status}: ${errorData.message || errorData.error}`)
        return false
      }
    } catch (error: any) {
      setStatusResponse(`❌ Erro de conexão: ${error.message}`)
      return false
    }
  }

  // Função para buscar IP do ESP32 através da URL do sistema
  const buscarIPDoSistema = async (sistemaUrl: string): Promise<string[]> => {
    try {
      console.log(`[SYSTEM_IP] Buscando IPs do sistema: ${sistemaUrl}`)
      
      // Usar proxy do Next.js para evitar CORS
      const response = await fetch('/api/proxy/buscar-gaveteiros', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sistemaUrl: sistemaUrl
        })
      })
      
      if (!response.ok) {
        // Tenta ler detalhes do erro
        let errorDetails = ''
        try {
          const errorData = await response.json()
          errorDetails = errorData.error || errorData.message || 'Erro desconhecido'
        } catch {
          errorDetails = 'Não foi possível ler detalhes do erro'
        }
        
        console.error(`[SYSTEM_IP] Erro ${response.status}:`, errorDetails)
        throw new Error(`Erro ao buscar gaveteiros: ${response.status} - ${errorDetails}`)
      }
      
      const data = await response.json()
      const gaveteiros = data.gaveteiros || []
      console.log(`[SYSTEM_IP] Gaveteiros encontrados:`, gaveteiros.length)
      
      // Extrair IPs dos gaveteiros
      const ips = gaveteiros
        .filter((g: any) => g.esp32_ip || g.codigo_hardware)
        .map((g: any) => {
          // Priorizar esp32_ip, senão tentar extrair IP do codigo_hardware
          if (g.esp32_ip) return g.esp32_ip
          
          // Se codigo_hardware for um IP, usar ele
          if (g.codigo_hardware && /^\d+\.\d+\.\d+\.\d+$/.test(g.codigo_hardware)) {
            return g.codigo_hardware
          }
          
          return null
        })
        .filter((ip: string | null) => ip !== null)
      
      console.log(`[SYSTEM_IP] IPs extraídos:`, ips)
      return ips
      
    } catch (error: any) {
      console.error('[SYSTEM_IP] Erro ao buscar IPs do sistema:', error)
      
      // Se já for um erro tratado, repassa
      if (error.message.includes('Erro ao buscar gaveteiros')) {
        throw error
      }
      
      // Erros de rede/conexão
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Erro de conexão com o proxy. Verifique se o servidor está online.')
      }
      
      throw new Error(`Erro inesperado: ${error.message}`)
    }
  }

  // Função para escanear rede em busca de ESP32s
  const escanearRede = async (): Promise<string[]> => {
    setStatusResponse('Escaneando rede em busca de ESP32s...')
    
    try {
      // Usa o proxy para scan de rede
      const response = await fetch('/api/proxy/scan-network', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Erro no scan: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.devices && data.devices.length > 0) {
        setStatusResponse(`${data.devices.length} ESP32s encontrados na rede`)
        
        // Extrai IPs dos dispositivos encontrados
        const ips = data.devices.map((d: any) => d.ip)
        console.log(`[SCAN] IPs encontrados:`, ips)
        
        return ips
      }
      
      // Se não encontrou via scan, tenta ranges comuns
      setStatusResponse('Testando ranges de rede comuns...')
      const commonRanges = [
        '192.168.1', '192.168.0', '192.168.2', 
        '10.0.0', '172.16.0'
      ]
      
      for (const range of commonRanges) {
        const ips = await testarRange(range)
        if (ips.length > 0) {
          setStatusResponse(`${ips.length} ESP32s encontrados em ${range}.x`)
          return ips
        }
      }
      
      setStatusResponse('Nenhum ESP32 encontrado na rede')
      return []
      
    } catch (error) {
      console.error('[SCAN] Erro ao escanear rede:', error)
      setStatusResponse('Erro ao escanear rede. Tente novamente.')
      return []
    }
  }

  // Função para testar um range de IPs
  const testarRange = async (range: string): Promise<string[]> => {
    const ipsEncontrados: string[] = []
    const promises = []
    
    // Testa IPs de 1 a 254 (limitado para não sobrecarregar)
    for (let i = 1; i <= 50; i++) {
      const ip = `${range}.${i}`
      promises.push(testarIP(ip, ipsEncontrados))
    }
    
    await Promise.all(promises)
    return ipsEncontrados
  }

  // Função para testar um IP específico
  const testarIP = async (ip: string, ipsEncontrados: string[]): Promise<void> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      
      const response = await fetch(`http://${ip}/discovery`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        if (data.device && data.device.startsWith('AIRE-ESP32-')) {
          ipsEncontrados.push(ip)
          console.log(`[SCAN] ✅ ESP32 encontrado: ${data.device} (${ip})`)
        }
      }
    } catch (error) {
      // Silenciosamente ignora falhas
    }
  }

  // Função para testar múltiplos IPs automaticamente
  const testarIPsAutomaticamente = async (ips: string[]): Promise<{ip: string, online: boolean}[]> => {
    const resultados = []
    
    for (const ip of ips) {
      try {
        console.log(`[AUTO_TEST] Testando IP: ${ip}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s por IP
        
        const response = await fetch(`/api/proxy/status-gaveteiro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ armarioIP: ip }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          resultados.push({ ip, online: true })
          console.log(`[AUTO_TEST] ✅ ${ip} - Online: ${data.armarioResponse || 'OK'}`)
        } else {
          resultados.push({ ip, online: false })
          console.log(`[AUTO_TEST] ❌ ${ip} - Erro HTTP: ${response.status}`)
        }
        
      } catch (error) {
        resultados.push({ ip, online: false })
        console.log(`[AUTO_TEST] ❌ ${ip} - Falha: ${error instanceof Error ? error.message : 'Erro'}`)
      }
    }
    
    return resultados
  }

  // Função completa de diagnóstico para identificar o problema específico
  const diagnosticarProblema = async (ip: string): Promise<{problema: string, solucoes: string[], detalhes: string}> => {
    console.log(`[DIAGNOSTIC] Iniciando diagnóstico completo para ${ip}`)
    
    const resultados = []
    
    // 1. Verificar formato do IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ip)) {
      return {
        problema: 'IP inválido',
        solucoes: [
          'Verifique se o IP está no formato correto (ex: 192.168.1.76)',
          'Use um IP válido na mesma rede do computador'
        ],
        detalhes: `O IP "${ip}" não está no formato válido XXX.XXX.XXX.XXX`
      }
    }
    
    // 2. Tentar diferentes métodos de conexão
    const metodos = [
      { nome: 'Status Endpoint', url: `/api/proxy/status-gaveteiro`, timeout: 8000 },
      { nome: 'Ping Básico', url: `/api/proxy/status-gaveteiro`, timeout: 5000 }
    ]
    
    for (const metodo of metodos) {
      try {
        console.log(`[DIAGNOSTIC] Testando ${metodo.nome}...`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), metodo.timeout)
        
        const response = await fetch(metodo.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ armarioIP: ip }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          return {
            problema: 'Conexão bem-sucedida',
            solucoes: [],
            detalhes: `${metodo.nome}: Dispositivo respondeu corretamente. Resposta: ${data.armarioResponse || 'OK'}`
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          resultados.push(`${metodo.nome}: Erro HTTP ${response.status} - ${errorData.error || 'Sem detalhes'}`)
        }
        
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            resultados.push(`${metodo.nome}: Timeout (${metodo.timeout}ms)`)
          } else if (error.message.includes('fetch failed')) {
            resultados.push(`${metodo.nome}: Falha de rede/conexão`)
          } else {
            resultados.push(`${metodo.nome}: ${error.message}`)
          }
        } else {
          resultados.push(`${metodo.nome}: Erro desconhecido`)
        }
      }
    }
    
    // 3. Analisar resultados para identificar problema específico
    const todosTimeout = resultados.every(r => r.includes('Timeout'))
    const todosFalhaRede = resultados.every(r => r.includes('Falha de rede'))
    
    if (todosTimeout) {
      return {
        problema: 'Timeout em todas as tentativas',
        solucoes: [
          'Verifique se o ESP32 está ligado e conectado à rede',
          'Espere mais tempo para o ESP32 inicializar (pode levar até 2 minutos)',
          'Verifique se o IP está correto',
          'Tente fazer ping do computador para o ESP32',
          'Verifique se o ESP32 está na mesma rede WiFi'
        ],
        detalhes: `O dispositivo não respondeu em nenhum dos testes. Resultados: ${resultados.join(', ')}`
      }
    }
    
    if (todosFalhaRede) {
      return {
        problema: 'Falha de rede',
        solucoes: [
          'Verifique se o computador está na mesma rede que o ESP32',
          'Desative temporariamente o firewall/antivírus',
          'Verifique se o roteador está bloqueando conexões locais',
          'Tente usar outro dispositivo na mesma rede',
          'Verifique se o ESP32 realmente está conectado ao WiFi'
        ],
        detalhes: `Falha de rede em todos os testes. Resultados: ${resultados.join(', ')}`
      }
    }
    
    return {
      problema: 'Problema misto ou desconhecido',
      solucoes: [
        'Verifique se o ESP32 está ligado',
        'Confirme o IP correto do dispositivo',
        'Verifique a conexão de rede',
        'Reinicie o ESP32',
        'Verifique o console do ESP32 para erros'
      ],
      detalhes: `Resultados dos testes: ${resultados.join(', ')}`
    }
  }

  // Função para verificar conectividade básica com o ESP32
  const verificarConectividadeBasica = async (ip: string): Promise<{online: boolean, details: string}> => {
    try {
      console.log(`[CONNECTIVITY] Testando conectividade básica com ${ip}`)
      
      // 🔍 SE FOR IP PADRÃO, TENTAR DESCOBERTA AUTOMÁTICA
      let ipParaTestar = ip
      if (ip === '192.168.1.76') {
        console.log('[CONNECTIVITY] IP padrão detectado, tentando descoberta automática...')
        
        // Tentar IPs próximos
        const ipsParaTestar = ['192.168.1.75', '192.168.1.74', '192.168.1.77']
        
        for (const ipTeste of ipsParaTestar) {
          try {
            console.log(`[CONNECTIVITY] Testando IP: ${ipTeste}`)
            // 🔧 USAR PROXY PARA EVITAR CORS
            const testResponse = await fetch(`/api/proxy/testar-discovery`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ip: ipTeste
              }),
              signal: AbortSignal.timeout(2000)
            })
            
            if (testResponse.ok) {
              const data = await testResponse.json()
              if (data.success && data.device && data.device.includes('AIRE-ESP32')) {
                console.log(`[CONNECTIVITY] ✅ ESP32 encontrado em: ${ipTeste}`)
                ipParaTestar = ipTeste
                break
              }
            }
          } catch (error) {
            console.log(`[CONNECTIVITY] ❌ IP ${ipTeste} não respondeu`)
          }
        }
      }
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 segundos para ping básico

      const response = await fetch(`/api/proxy/status-gaveteiro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          armarioIP: ipParaTestar  // ✅ Usar IP descoberto
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      
      // Se receber qualquer resposta (mesmo erro), o dispositivo está online
      const data = await response.json()
      
      // 🔄 Se encontrou IP diferente, atualizar o estado
      if (ipParaTestar !== ip) {
        console.log(`[CONNECTIVITY] 🔄 Atualizando IP de ${ip} para ${ipParaTestar}`)
        setArmarioIP(ipParaTestar)  // Atualiza o IP no frontend
      }
      
      if (response.ok) {
        return { 
          online: true, 
          details: `Dispositivo respondeu corretamente. Resposta: ${data.armarioResponse || 'OK'}` 
        }
      } else {
        // Se recebeu erro HTTP mas o dispositivo respondeu, está online mas com problema
        return { 
          online: true, 
          details: `Dispositivo online mas retornou erro: ${data.error || 'Erro desconhecido'}` 
        }
      }
      
    } catch (error) {
      console.log(`[CONNECTIVITY] Dispositivo ${ip} não responde:`, error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { 
            online: false, 
            details: `Timeout de 8s. O ESP32 pode estar inicializando ou muito lento.` 
          }
        } else if (error.message.includes('fetch failed')) {
          return { 
            online: false, 
            details: `Falha de rede. Verifique se o computador está na mesma rede que o ESP32.` 
          }
        } else {
          return { 
            online: false, 
            details: `Erro de conexão: ${error.message}` 
          }
        }
      }
      
      return { 
        online: false, 
        details: 'Erro desconhecido na verificação de conectividade' 
      }
    }
  }

  // Função para buscar IPs do sistema
  const buscarIPsDoSistema = async () => {
    setBuscandoIPs(true)
    setIpsEncontrados([])
    setResultadosTeste([])
    setStatusResponse('Buscando IPs do sistema...')
    
    try {
      const ips = await buscarIPDoSistema(sistemaUrl)
      setIpsEncontrados(ips)
      
      if (ips.length === 0) {
        setStatusResponse('Nenhum ESP32 encontrado no sistema')
        setResult({ 
          success: false, 
          message: 'Nenhum ESP32 encontrado no sistema. Verifique a URL ou tente escanear a rede.' 
        })
      } else {
        setStatusResponse(`${ips.length} IPs encontrados: ${ips.join(', ')}`)
        
        // Testar automaticamente os IPs encontrados
        await testarIPsEncontrados(ips)
      }
    } catch (error: any) {
      console.error('Erro ao buscar IPs:', error)
      setStatusResponse('Erro ao buscar IPs do sistema')
      setResult({ 
        success: false, 
        message: `Erro ao buscar IPs: ${error.message || 'Erro desconhecido'}. Tente escanear a rede local.` 
      })
    } finally {
      setBuscandoIPs(false)
    }
  }

  // Função para escanear rede automaticamente
  const escanearRedeAutomaticamente = async () => {
    setBuscandoIPs(true)
    setIpsEncontrados([])
    setResultadosTeste([])
    
    try {
      const ips = await escanearRede()
      setIpsEncontrados(ips)
      
      if (ips.length === 0) {
        setStatusResponse('Nenhum ESP32 encontrado na rede')
        setResult({ 
          success: false, 
          message: 'Nenhum ESP32 encontrado na rede. Verifique se estão ligados e na mesma rede.' 
        })
      } else {
        setStatusResponse(`${ips.length} ESP32s encontrados na rede`)
        
        // Testar automaticamente os IPs encontrados
        await testarIPsEncontrados(ips)
      }
    } catch (error: any) {
      console.error('Erro ao escanear rede:', error)
      setStatusResponse('Erro ao escanear rede')
      setResult({ 
        success: false, 
        message: `Erro ao escanear rede: ${error.message || 'Erro desconhecido'}. Tente novamente.` 
      })
    } finally {
      setBuscandoIPs(false)
    }
  }

  // Função para testar IPs encontrados
  const testarIPsEncontrados = async (ips: string[]) => {
    setTestandoIPs(true)
    setStatusResponse('Testando conexão com os ESP32s...')
    
    try {
      const resultados = await testarIPsAutomaticamente(ips)
      setResultadosTeste(resultados)
      
      const onlineCount = resultados.filter(r => r.online).length
      setStatusResponse(`${onlineCount}/${resultados.length} ESP32s online`)
      
      if (onlineCount > 0) {
        // Usar o primeiro IP online como armarioIP
        const primeiroIPOnline = resultados.find(r => r.online)?.ip
        if (primeiroIPOnline) {
          setArmarioIP(primeiroIPOnline)
          setResult({ 
            success: true, 
            message: `${onlineCount} ESP32(s) encontrado(s)! Usando IP: ${primeiroIPOnline}` 
          })
        }
      } else {
        setResult({ 
          success: false, 
          message: 'Nenhum ESP32 online. Verifique se estão ligados e na mesma rede.' 
        })
      }
    } catch (error) {
      console.error('Erro ao testar IPs:', error)
      setStatusResponse('Erro ao testar IPs')
    } finally {
      setTestandoIPs(false)
    }
  }

  // Função para executar diagnóstico completo
  const executarDiagnostico = async () => {
    setDiagnosticando(true)
    setDiagnostico(null)
    setStatusResponse('Executando diagnóstico completo...')
    
    try {
      const resultado = await diagnosticarProblema(armarioIP)
      setDiagnostico(resultado)
      setStatusResponse(`Diagnóstico: ${resultado.problema}`)
      
      if (resultado.problema === 'Conexão bem-sucedida') {
        setResult({ 
          success: true, 
          message: 'ESP32 encontrado e respondendo corretamente!' 
        })
      } else {
        setResult({ 
          success: false, 
          message: `Problema identificado: ${resultado.problema}` 
        })
      }
    } catch (error) {
      console.error('Erro no diagnóstico:', error)
      setDiagnostico({
        problema: 'Erro no diagnóstico',
        solucoes: ['Tente novamente', 'Verifique a conexão', 'Reinicie o sistema'],
        detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setDiagnosticando(false)
    }
  }

  // Função para verificar status do gaveteiro (mantida para uso interno do diagnóstico)
  const verificarStatusGaveteiro = async () => {
    setCheckingStatus(true)
    setGaveteiroStatus(null)
    setStatusResponse('')

    try {
      // Primeiro verificar conectividade básica
      const connectivityResult = await verificarConectividadeBasica(armarioIP)
      console.log(`[CONNECTIVITY] Resultado:`, connectivityResult)
      
      if (!connectivityResult.online) {
        setStatusResponse(connectivityResult.details)
        throw new Error(`ESP32 não encontrado. ${connectivityResult.details}`)
      }

      // Se está online, mostrar detalhes da conectividade
      setStatusResponse(connectivityResult.details)

      // Usar proxy com timeout maior para verificar status do gaveteiro
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 segundos

      const response = await fetch('/api/proxy/status-gaveteiro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          armarioIP: armarioIP
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Se a resposta não for ok, mas tiver dados, tentar extrair informação útil
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.warn('Resposta não é JSON válido:', jsonError)
        data = { error: 'Resposta inválida do servidor' }
      }

      if (!response.ok) {
        const errorMessage = data.error || `Erro HTTP ${response.status}: ${response.statusText}`
        
        // Se for erro de conexão, dar mensagem mais útil
        if (response.status === 0 || errorMessage.includes('fetch failed')) {
          throw new Error('ESP32 não encontrado. Verifique o IP e a conexão de rede. O dispositivo pode estar inicializando.')
        }
        
        throw new Error(errorMessage)
      }

      // Mostrar a resposta bruta do gaveteiro
      setStatusResponse(`${connectivityResult.details} | Status: ${data.armarioResponse || 'Sem resposta'}`)

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
          errorMessage = 'Timeout na comunicação com o gaveteiro. Verifique se o IP está correto e se o dispositivo está online. O ESP32 pode estar inicializando.'
          setStatusResponse('Timeout - Sem resposta do gaveteiro (20s)')
        } else if (error.message.includes('fetch failed')) {
          errorMessage = 'ESP32 não encontrado. Verifique o IP e a conexão. O dispositivo pode estar inicializando ou desconectado.'
          setStatusResponse('Falha na conexão - Verifique o IP e rede')
        } else {
          errorMessage = error.message
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

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header moderno */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-sky-50 text-blue-600 hover:from-blue-100 hover:to-sky-100 rounded-xl transition-all font-medium border border-blue-200"
              >
                <ArrowLeft size={20} />
                <span>Voltar</span>
              </button>
              
              <div className="text-center flex-1">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-sky-600 rounded-xl flex items-center justify-center text-white">
                    <Wifi size={24} />
                  </div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent">
                    Configurar ESP32
                  </h1>
                </div>
                <p className="text-gray-600">
                  Configure o WiFi do seu dispositivo ESP32
                </p>
              </div>
              
              <div className="w-20"></div> {/* Spacer para centralizar */}
            </div>
          </div>

          {/* Abas modernas */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('config')}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'config'
                    ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border-2 border-gray-400'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Wifi size={18} />
                  <span>Configurar WiFi</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('reset')}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'reset'
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border-2 border-gray-400'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw size={18} />
                  <span>Resetar WiFi</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('test')}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'test'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border-2 border-gray-400'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <TestTube size={18} />
                  <span>Testar Gaveteiros</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conteúdo da aba Configurar */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              {/* Aviso importante de conexão */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white">
                    <AlertCircle size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-orange-900">Conexão Obrigatória</h3>
                </div>
                <div className="bg-white/80 rounded-xl p-4 border border-orange-200">
                  <p className="text-sm font-semibold text-orange-800 mb-2">
                    ⚠️ Antes de configurar, conecte-se ao WiFi do gaveteiro:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="bg-orange-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-orange-700 mb-1">Nome da Rede:</p>
                      <p className="text-sm font-bold text-orange-900">AIRE-CONFIG</p>
                    </div>
                    <div className="bg-orange-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-orange-700 mb-1">Senha:</p>
                      <p className="text-sm font-bold text-orange-900">12345678</p>
                    </div>
                  </div>
                  <p className="text-xs text-orange-600 mt-3">
                    Após conectar, volte a esta página para configurar o WiFi do seu condomínio.
                  </p>
                </div>
              </div>

              {/* Guia passo a passo */}
              <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                    <Info size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-blue-900">Guia de Configuração</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">1</div>
                      <p className="text-sm text-blue-800">Conecte-se à rede "ESP32-AP"</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">2</div>
                      <p className="text-sm text-blue-800">Verifique o IP (padrão: 192.168.4.1)</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">3</div>
                      <p className="text-sm text-blue-800">Teste a conexão primeiro</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">4</div>
                      <p className="text-sm text-blue-800">Preencha SSID e senha</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">5</div>
                      <p className="text-sm text-blue-800">Clique em "Configurar WiFi"</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">6</div>
                      <p className="text-sm text-blue-800">Aguarde a reinicialização</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* IP do ESP32 */}
                  <div>
                    <label htmlFor="espIP" className="block text-sm font-semibold text-gray-700 mb-2">
                      IP do ESP32
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Server size={18} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="espIP"
                        value={espIP}
                        onChange={(e) => setEspIP(e.target.value)}
                        className="pl-10 block w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="192.168.4.1"
                        required
                      />
                    </div>
                  </div>

                  {/* Botões de teste - APENAS DIAGNÓSTICO */}
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      type="button"
                      onClick={executarDiagnostico}
                      disabled={diagnosticando || checkingStatus}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
                    >
                      <AlertCircle size={18} />
                      {diagnosticando ? 'Diagnosticando...' : 'Diagnóstico Completo'}
                    </button>
                  </div>

                  {/* Status do gaveteiro */}
                  {gaveteiroStatus && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white">
                          <CheckCircle size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-900">
                            Gaveteiro Conectado!
                          </p>
                          <p className="text-sm text-green-700">
                            Modo: {gaveteiroStatus.modo.toUpperCase()} | IP: {gaveteiroStatus.ip}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resultado do Diagnóstico */}
                  {diagnostico && (
                    <div className={`border rounded-xl p-4 ${
                      diagnostico.problema === 'Conexão bem-sucedida' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                          diagnostico.problema === 'Conexão bem-sucedida' 
                            ? 'bg-green-500' 
                            : 'bg-orange-500'
                        }`}>
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${
                            diagnostico.problema === 'Conexão bem-sucedida' 
                              ? 'text-green-900' 
                              : 'text-orange-900'
                          }`}>
                            {diagnostico.problema}
                          </p>
                          <p className={`text-xs mt-1 ${
                            diagnostico.problema === 'Conexão bem-sucedida' 
                              ? 'text-green-700' 
                              : 'text-orange-700'
                          }`}>
                            {diagnostico.detalhes}
                          </p>
                          
                          {diagnostico.solucoes.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-orange-900 mb-2">Soluções sugeridas:</p>
                              <ul className="text-xs text-orange-700 space-y-1">
                                {diagnostico.solucoes.map((solucao, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <span className="text-orange-500 mt-0.5">•</span>
                                    <span>{solucao}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SSID */}
                  <div>
                    <label htmlFor="ssid" className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome da Rede WiFi (SSID)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Wifi size={18} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="ssid"
                        value={ssid}
                        onChange={(e) => setSsid(e.target.value)}
                        className="pl-10 block w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="Nome da Rede WiFi"
                        required
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Prefira redes 2.4GHz para melhor compatibilidade
                    </p>
                  </div>

                  {/* Senha */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                      Senha do WiFi
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={18} className="text-gray-400" />
                      </div>
                      <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 block w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="Senha do WiFi"
                        required
                      />
                    </div>
                  </div>

                  {/* Botão principal */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 text-white py-4 px-4 rounded-xl hover:from-blue-700 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all text-lg font-semibold shadow-lg"
                  >
                    <Send size={20} />
                    {loading ? 'Enviando configuração...' : 'Configurar WiFi'}
                  </button>
                </form>
              </div>
            </div>
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
                {/* URL do Sistema para buscar IPs */}
                <div>
                  <label htmlFor="sistemaUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    URL do Sistema (para buscar IPs automaticamente)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      id="sistemaUrl"
                      value={sistemaUrl}
                      onChange={(e) => setSistemaUrl(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="http://app.contatoaire.com"
                    />
                    <button
                      type="button"
                      onClick={testarConexaoSistema}
                      disabled={buscandoIPs || testandoIPs}
                      className="px-3 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-md hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 transition-all"
                      title="Testar se o sistema está acessível"
                    >
                      🔗
                    </button>
                    <button
                      type="button"
                      onClick={buscarIPsDoSistema}
                      disabled={buscandoIPs || testandoIPs}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-md hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                    >
                      {buscandoIPs || testandoIPs ? 'Buscando...' : 'Buscar IPs'}
                    </button>
                    <button
                      type="button"
                      onClick={escanearRedeAutomaticamente}
                      disabled={buscandoIPs || testandoIPs}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-md hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all"
                    >
                      {buscandoIPs || testandoIPs ? 'Escaneando...' : '🔍 Escanear Rede'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    🔗 Testa conexão | Busca IPs do sistema | 🔍 Escaneia rede local em busca de ESP32s
                  </p>
                </div>

                {/* Resultados da busca de IPs */}
                {resultadosTeste.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Resultados do Teste:</h4>
                    <div className="space-y-2">
                      {resultadosTeste.map((resultado, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              resultado.online ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                            <span className="text-sm font-medium">{resultado.ip}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            resultado.online 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {resultado.online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    IP do ESP32 já configurado na rede do condomínio
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
