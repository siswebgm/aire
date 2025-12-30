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
    const timeoutId = setTimeout(() => controller.abort(), 15000) // Aumentado para 15 segundos

    // Construir URL exata para log e resposta
    const exactURL = `http://${armarioIP}/status`
    console.log(`[PROXY] URL exata enviada: ${exactURL}`)

    const response = await fetch(exactURL, {
      method: 'GET',
      signal: controller.signal
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
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Armário não encontrado. Verifique o IP e a conexão.'
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout na comunicação com o armário.'
      } else {
        errorMessage = error.message
      }
    }

    return res.status(500).json({ 
      error: errorMessage 
    })
  }
}
