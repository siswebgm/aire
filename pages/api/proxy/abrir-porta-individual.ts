import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { supabase } from '../../../src/lib/supabaseClient'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { condominioUid, portaUid, porta } = req.body

    // Validações
    if (!condominioUid || !portaUid || !porta) {
      return res.status(400).json({ error: 'condominioUid, portaUid e porta são obrigatórios' })
    }

    console.log(`[PROXY] Abrindo porta individual: ${porta} para condomínio ${condominioUid}`)

    // Gerar token SHA256
    const tokenData = `${condominioUid}:${portaUid}:${porta}:AIRE_2025_SUPER_SECRETO`
    const securityToken = crypto.createHash('sha256').update(tokenData).digest('hex')
    
    console.log(`[PROXY] Token gerado para porta ${porta}`)

    // Buscar IP do condomínio usando Supabase client
    const { data: condominios, error: condominioError } = await supabase
      .from('gvt_condominios')
      .select('esp32_ip, nome')
      .eq('uid', condominioUid)
      .single()

    if (condominioError || !condominios) {
      console.error('[PROXY] Erro ao buscar condomínio:', condominioError)
      throw new Error('Condomínio não encontrado')
    }

    const esp32Ip = condominios.esp32_ip || '192.168.1.76'
    console.log(`[PROXY] Usando ESP32 IP: ${esp32Ip}`)

    // Construir URL
    const esp32Url = `http://${esp32Ip}/abrir?condominio_uid=${condominioUid}&porta_uid=${portaUid}&porta=${porta}&token=${securityToken}`
    console.log(`[PROXY] URL completa: ${esp32Url}`)

    // Enviar requisição para o ESP32
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    let esp32Response: string
    let portaAberta = false

    try {
      const response = await fetch(esp32Url, {
        method: 'GET',
        signal: controller.signal
      })

      esp32Response = await response.text()
      console.log(`[PROXY] ESP32 respondeu (${response.status}):`, esp32Response)

      // Verificar se a porta foi aberta com sucesso
      portaAberta = response.ok && (
        esp32Response.includes('ABERTA') || 
        esp32Response.includes('aberta') || 
        esp32Response.includes('ok') ||
        esp32Response.includes('success')
      )

    } catch (error: any) {
      console.error('[PROXY] Erro ao comunicar com ESP32:', error)
      esp32Response = error?.message || 'Erro desconhecido'
    } finally {
      clearTimeout(timeoutId)
    }

    return res.status(200).json({
      success: portaAberta,
      message: portaAberta ? `Porta ${porta} aberta com sucesso!` : `Não foi possível abrir a porta ${porta}`,
      esp32Response: esp32Response,
      esp32Url: esp32Url,
      porta: porta,
      portaUid: portaUid
    })

  } catch (error) {
    console.error('[PROXY] Erro geral:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
}
