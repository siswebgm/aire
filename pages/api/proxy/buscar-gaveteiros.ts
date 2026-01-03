import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sistemaUrl } = req.body

    if (!sistemaUrl) {
      return res.status(400).json({ error: 'URL do sistema é obrigatória' })
    }

    // Valida URL básica
    try {
      new URL(sistemaUrl)
    } catch {
      return res.status(400).json({ error: 'URL inválida' })
    }

    console.log(`[PROXY] Buscando gaveteiros do sistema: ${sistemaUrl}`)

    // Faz requisição para o sistema externo
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 segundos timeout

    let response
    try {
      response = await fetch(`${sistemaUrl}/api/gaveteiros`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AIRE-ESP32-Proxy/1.0'
        },
        signal: controller.signal
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      console.error('[PROXY] Erro no fetch:', fetchError)
      
      if (fetchError.name === 'AbortError') {
        return res.status(408).json({ 
          error: 'Timeout na requisição',
          message: 'O sistema externo não respondeu a tempo (15s)',
          details: 'Tente novamente ou verifique se o sistema está online'
        })
      }

      if (fetchError.code === 'ECONNREFUSED') {
        return res.status(503).json({ 
          error: 'Sistema indisponível',
          message: 'Não foi possível conectar ao sistema externo',
          details: 'Verifique se o sistema está online e acessível'
        })
      }

      if (fetchError.code === 'ENOTFOUND') {
        return res.status(503).json({ 
          error: 'Sistema não encontrado',
          message: 'O hostname do sistema não pôde ser resolvido',
          details: 'Verifique se a URL está correta e o DNS está funcionando'
        })
      }

      return res.status(500).json({ 
        error: 'Erro de conexão',
        message: 'Falha ao conectar com o sistema externo',
        details: fetchError.message || 'Erro desconhecido'
      })
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[PROXY] Erro na resposta: ${response.status} ${response.statusText}`)
      
      // Tenta ler o corpo da resposta para mais detalhes
      let errorBody = ''
      try {
        errorBody = await response.text()
        console.error('[PROXY] Corpo do erro:', errorBody)
      } catch {
        errorBody = 'Não foi possível ler o corpo da resposta'
      }

      return res.status(response.status).json({ 
        error: `Erro HTTP ${response.status}`,
        message: `O sistema retornou status ${response.status}`,
        status: response.status,
        statusText: response.statusText,
        details: errorBody.substring(0, 500) // Limita tamanho
      })
    }

    let gaveteiros
    try {
      gaveteiros = await response.json()
    } catch (jsonError: any) {
      console.error('[PROXY] Erro ao parsear JSON:', jsonError)
      
      // Tenta ler como texto para debug
      let textBody = ''
      try {
        textBody = await response.clone().text()
        console.error('[PROXY] Resposta como texto:', textBody.substring(0, 200))
      } catch {
        textBody = 'Não foi possível ler a resposta'
      }

      return res.status(500).json({ 
        error: 'Resposta inválida',
        message: 'O sistema não retornou um JSON válido',
        details: `Erro: ${jsonError?.message || 'Erro desconhecido'}. Resposta: ${textBody.substring(0, 200)}`
      })
    }

    console.log(`[PROXY] ${Array.isArray(gaveteiros) ? gaveteiros.length : 0} gaveteiros encontrados`)

    // Processa e valida os dados
    const gaveteirosProcessados = (Array.isArray(gaveteiros) ? gaveteiros : []).map((g: any, index: number) => {
      return {
        index,
        uid: g.uid || `gaveteiro-${index}`,
        nome: g.nome || `Gaveteiro ${index + 1}`,
        esp32_ip: g.esp32_ip || g.codigo_hardware || null,
        codigo_hardware: g.codigo_hardware || null,
        status: g.status || 'ativo',
        condominio_uid: g.condominio_uid || null
      }
    })

    // Extrai IPs válidos
    const ipsValidos = gaveteirosProcessados
      .filter((g: any) => g.esp32_ip)
      .map((g: any) => g.esp32_ip)

    console.log(`[PROXY] ${ipsValidos.length} IPs válidos extraídos:`, ipsValidos)

    return res.status(200).json({
      success: true,
      gaveteiros: gaveteirosProcessados,
      ips: ipsValidos,
      total: gaveteirosProcessados.length,
      totalComIP: ipsValidos.length,
      sistemaUrl
    })

  } catch (error: any) {
    console.error('[PROXY] Erro geral:', error)
    
    return res.status(500).json({ 
      error: 'Erro interno do proxy',
      message: 'Ocorreu um erro inesperado no servidor proxy',
      details: error.message || 'Erro desconhecido',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
