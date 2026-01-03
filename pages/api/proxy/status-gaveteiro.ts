import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { armarioIP } = req.body

    // Validações
    if (!armarioIP) {
      return res.status(400).json({ error: 'IP do armário é obrigatório' })
    }

    console.log(`[PROXY] Verificando status do gaveteiro em ${armarioIP}`)

    // Enviar requisição para o armário (server-side não tem CORS)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // Aumentado para 20 segundos

    // Construir URL exata para log e resposta
    const exactURL = `http://${armarioIP}/status`
    console.log(`[PROXY] URL exata enviada: ${exactURL}`)

    const response = await fetch(exactURL, {
      method: 'GET',
      signal: controller.signal,
      // Adicionar headers para melhor compatibilidade
      headers: {
        'User-Agent': 'GaveteiroManager/1.0',
        'Accept': 'application/json, text/plain, */*',
        'Connection': 'keep-alive'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Armário retornou status ${response.status}`)
    }

    // Tentar ler resposta do armário
    let responseData
    let parsedResponse = null
    try {
      responseData = await response.text()
      
      // Tentar fazer parse do JSON
      try {
        parsedResponse = JSON.parse(responseData)
      } catch (e) {
        // Se não for JSON, mantém como texto
        console.log('[PROXY] Resposta não é JSON, tratando como texto')
      }
    } catch (e) {
      responseData = 'Resposta não legível'
    }

    console.log(`[PROXY] Armário respondeu: ${responseData}`)

    return res.status(200).json({ 
      success: true, 
      message: 'Status verificado com sucesso!',
      armarioResponse: responseData,
      exactURL: exactURL,
      parsedResponse: parsedResponse
    })

  } catch (error) {
    console.error('[PROXY] Erro ao verificar status:', error)
    
    let errorMessage = 'Erro ao comunicar com o armário'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout na comunicação com o armário (20s). O ESP32 pode estar inicializando.'
        statusCode = 408
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        errorMessage = 'ESP32 não encontrado. Verifique o IP e a conexão de rede. O dispositivo pode estar desligado ou em outro IP.'
        statusCode = 503
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        errorMessage = 'IP não encontrado na rede. Verifique se o ESP32 está conectado e se o IP está correto.'
        statusCode = 503
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout na comunicação com o armário.'
        statusCode = 408
      } else {
        errorMessage = error.message
      }
    }

    return res.status(statusCode).json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
}
