import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Obtém informações da rede do cliente
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress

    console.log(`[SCAN] Client IP: ${clientIP}`)

    // Se não conseguir determinar o IP, retorna ranges comuns
    if (!clientIP || typeof clientIP !== 'string') {
      return res.status(200).json({
        success: true,
        ranges: ['192.168.1', '192.168.0', '192.168.2', '10.0.0', '172.16.0'],
        message: 'Usando ranges comuns (não foi possível determinar a rede)'
      })
    }

    // Extrai o range do IP do cliente
    const ipParts = clientIP.split('.')
    if (ipParts.length !== 4) {
      return res.status(200).json({
        success: true,
        ranges: ['192.168.1', '192.168.0', '192.168.2', '10.0.0', '172.16.0'],
        message: 'IP inválido, usando ranges comuns'
      })
    }

    const networkRange = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`

    // Gera lista de IPs para testar (limitado para não sobrecarregar)
    const ipsToTest = []
    for (let i = 1; i <= 254; i++) {
      ipsToTest.push(`${networkRange}.${i}`)
    }

    console.log(`[SCAN] Escaneando range: ${networkRange}.x (${ipsToTest.length} IPs)`)

    // Testa IPs em paralelo (com limite para não sobrecarregar)
    const batchSize = 20
    const foundDevices = []

    for (let i = 0; i < ipsToTest.length; i += batchSize) {
      const batch = ipsToTest.slice(i, i + batchSize)
      const promises = batch.map(ip => testDevice(ip))
      
      try {
        const results = await Promise.allSettled(promises)
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            foundDevices.push(result.value)
          }
        }
      } catch (error) {
        console.error(`[SCAN] Erro no batch ${i}-${i + batchSize}:`, error)
      }

      // Pequeno delay entre batches para não sobrecarregar a rede
      if (i + batchSize < ipsToTest.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`[SCAN] Encontrados ${foundDevices.length} ESP32s`)

    return res.status(200).json({
      success: true,
      networkRange,
      devices: foundDevices,
      totalScanned: ipsToTest.length,
      message: `Escaneamento concluído: ${foundDevices.length} dispositivos encontrados`
    })

  } catch (error) {
    console.error('[SCAN] Erro no scan:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao escanear rede',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
}

// Função para testar se um IP tem um ESP32 AIRE
async function testDevice(ip: string): Promise<any | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    const response = await fetch(`http://${ip}/discovery`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AIRE-ESP32-Scanner/1.0'
      }
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      
      // Verifica se é um ESP32 AIRE
      if (data.device && data.device.startsWith('AIRE-ESP32-')) {
        console.log(`[SCAN] ✅ ESP32 encontrado: ${data.device} (${ip})`)
        
        return {
          ip,
          device: data.device,
          id: data.id,
          hostname: data.hostname,
          status: data.status,
          uptime: data.uptime,
          memoria_livre: data.memoria_livre,
          rssi: data.rssi,
          timestamp: data.timestamp
        }
      }
    }

    return null

  } catch (error) {
    // Silenciosamente ignora falhas (a maioria dos IPs não responderá)
    return null
  }
}
