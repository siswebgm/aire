import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { ip } = req.body

    if (!ip) {
      return res.status(400).json({ error: 'IP é obrigatório' })
    }

    console.log(`[PROXY] Testando discovery em: ${ip}`)

    // Fazer requisição para o ESP32 (server-side não tem CORS)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    try {
      const response = await fetch(`http://${ip}/discovery`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AIRE-ESP32-Proxy/1.0',
          'Accept': 'application/json',
          'Connection': 'keep-alive'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`ESP32 retornou status ${response.status}`)
      }

      const data = await response.json()
      
      console.log(`[PROXY] ✅ ESP32 encontrado em: ${ip}`)
      console.log(`[PROXY] Device: ${data.device}`)

      return res.status(200).json({
        success: true,
        device: data.device,
        ip: ip,
        data: data
      })

    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        console.log(`[PROXY] ❌ Timeout ao testar IP: ${ip}`)
        return res.status(200).json({
          success: false,
          error: 'Timeout',
          message: 'ESP32 não respondeu a tempo',
          ip
        })
      }

      console.log(`[PROXY] ❌ Erro ao testar IP ${ip}:`, fetchError.message)
      return res.status(200).json({
        success: false,
        error: 'Erro de conexão',
        message: fetchError.message,
        ip
      })
    }

  } catch (error: any) {
    console.error('[PROXY] Erro geral:', error)
    return res.status(500).json({ 
      success: false,
      error: 'Erro interno',
      message: error.message 
    })
  }
}
