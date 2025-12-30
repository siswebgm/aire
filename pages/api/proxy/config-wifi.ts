import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas POST permitido (mas vamos usar GET com params no ESP32)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { ssid, password, espIP = '192.168.4.1' } = req.body

    // Validações
    if (!ssid || !password) {
      return res.status(400).json({ error: 'SSID e password são obrigatórios' })
    }

    console.log(`[PROXY] Enviando configuração WiFi para ESP32 em ${espIP}`)

    // Enviar requisição GET com parâmetros para o ESP32 (server-side não tem CORS)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    // Codificar parâmetros para URL
    const encodedSSID = encodeURIComponent(ssid)
    const encodedPassword = encodeURIComponent(password)
    
    // Construir URL exata para log e resposta
    const exactURL = `http://${espIP}/config-wifi?ssid=${encodedSSID}&password=${encodedPassword}`
    console.log(`[PROXY] URL exata enviada: ${exactURL}`)

    const response = await fetch(exactURL, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`ESP32 retornou status ${response.status}`)
    }

    // Tentar ler resposta do ESP32
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

    console.log(`[PROXY] ESP32 respondeu: ${responseData}`)

    // Verificar se o ESP32 retornou sucesso
    let successMessage = 'Configuração enviada com sucesso!'
    if (parsedResponse && parsedResponse.ok === true) {
      successMessage = parsedResponse.msg || 'wifi_salvo_reiniciando'
    }

    return res.status(200).json({ 
      success: true, 
      message: successMessage,
      espResponse: responseData,
      exactURL: exactURL,
      parsedResponse: parsedResponse
    })

  } catch (error) {
    console.error('[PROXY] Erro ao configurar WiFi:', error)
    
    let errorMessage = 'Erro ao comunicar com ESP32'
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'ESP32 não encontrado. Verifique se está conectado à rede "ESP32-AP".'
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout na comunicação com ESP32.'
      } else {
        errorMessage = error.message
      }
    }

    return res.status(500).json({ 
      error: errorMessage 
    })
  }
}
