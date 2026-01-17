import { NextApiRequest, NextApiResponse } from 'next'
 import os from 'os'

 function normalizeClientIp(raw: unknown): string | null {
   if (!raw || typeof raw !== 'string') return null

   // x-forwarded-for can be a list: "client, proxy1, proxy2"
   const first = raw.split(',')[0]?.trim()
   if (!first) return null

   // IPv6-mapped IPv4: ::ffff:192.168.1.10
   if (first.startsWith('::ffff:')) return first.replace('::ffff:', '')

   return first
 }

 function getLocalLanIPv4(): string | null {
   const nets = os.networkInterfaces()
   for (const name of Object.keys(nets)) {
     const addrs = nets[name] ?? []
     for (const addr of addrs) {
       if (!addr) continue
       if (addr.family !== 'IPv4') continue
       if (addr.internal) continue

       // Prefer private ranges
       const ip = addr.address
       if (
         ip.startsWith('192.168.') ||
         ip.startsWith('10.') ||
         ip.startsWith('172.16.') ||
         ip.startsWith('172.17.') ||
         ip.startsWith('172.18.') ||
         ip.startsWith('172.19.') ||
         ip.startsWith('172.2') ||
         ip.startsWith('172.30.') ||
         ip.startsWith('172.31.')
       ) {
         return ip
       }
     }
   }

   // Fallback: first non-internal IPv4
   for (const name of Object.keys(nets)) {
     const addrs = nets[name] ?? []
     for (const addr of addrs) {
       if (!addr) continue
       if (addr.family === 'IPv4' && !addr.internal) return addr.address
     }
   }

   return null
 }

 function getNetworkRangeFromIp(ip: string): string | null {
   const ipParts = ip.split('.')
   if (ipParts.length !== 4) return null
   return `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`
 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Obtém informações da rede do cliente
    const rawClientIP = (req.headers['x-forwarded-for'] as string | undefined) ||
      (req.headers['x-real-ip'] as string | undefined) ||
      (req.connection.remoteAddress as string | undefined)

    const clientIP = normalizeClientIp(rawClientIP)
    console.log(`[SCAN] Client IP (raw): ${rawClientIP}`)
    console.log(`[SCAN] Client IP (normalized): ${clientIP}`)

    let networkRange = clientIP ? getNetworkRangeFromIp(clientIP) : null
    const isLocalhostClient = clientIP === '127.0.0.1' || clientIP === '::1'

    if (!networkRange || isLocalhostClient) {
      const lanIp = getLocalLanIPv4()
      const lanRange = lanIp ? getNetworkRangeFromIp(lanIp) : null
      console.log(`[SCAN] LAN IP detected: ${lanIp}`)
      console.log(`[SCAN] LAN range detected: ${lanRange}`)
      networkRange = lanRange
    }

    // Se ainda não conseguir determinar o range, retorna ranges comuns
    if (!networkRange) {
      return res.status(200).json({
        success: true,
        ranges: ['192.168.1', '192.168.0', '192.168.2', '10.0.0', '172.16.0'],
        message: 'Não foi possível determinar a rede automaticamente, usando ranges comuns'
      })
    }

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
