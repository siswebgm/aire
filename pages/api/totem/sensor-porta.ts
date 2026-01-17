import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../src/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { condominioUid, numeroPorta } = req.body as {
      condominioUid?: string
      numeroPorta?: number
    }

    if (!condominioUid || !numeroPorta) {
      return res.status(400).json({ error: 'condominioUid e numeroPorta são obrigatórios' })
    }

    const { data: condominio, error: condominioError } = await supabase
      .from('gvt_condominios')
      .select('esp32_ip, uid')
      .eq('uid', condominioUid)
      .single()

    if (condominioError || !condominio) {
      return res.status(404).json({ error: 'Condomínio não encontrado' })
    }

    const esp32Ip = condominio.esp32_ip || '192.168.1.76'
    const sensorUrl = `http://${esp32Ip}/sensor?porta=${encodeURIComponent(String(numeroPorta))}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 7000)

    let payload: any = null

    try {
      const response = await fetch(sensorUrl, {
        method: 'GET',
        signal: controller.signal
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return res.status(502).json({
          error: 'Falha ao consultar ESP32',
          status: response.status,
          body: text,
          sensorUrl
        })
      }

      payload = await response.json()
    } finally {
      clearTimeout(timeoutId)
    }

    const sensor = String(payload?.sensor || '').toLowerCase()
    const sensorNormalizado = sensor === 'aberto' || sensor === 'fechado' ? sensor : 'desconhecido'

    const { data: porta, error: portaError } = await supabase
      .from('gvt_portas')
      .select('uid')
      .eq('condominio_uid', condominioUid)
      .eq('numero_porta', numeroPorta)
      .single()

    if (portaError || !porta) {
      return res.status(404).json({ error: 'Porta não encontrada' })
    }

    const { error: updateError } = await supabase
      .from('gvt_portas')
      .update({
        sensor_ima_status: sensorNormalizado,
        sensor_ima_atualizado_em: new Date().toISOString()
      })
      .eq('uid', porta.uid)

    if (updateError) {
      return res.status(500).json({ error: 'Erro ao atualizar sensor no banco' })
    }

    return res.status(200).json({
      success: true,
      sensorUrl,
      sensor: sensorNormalizado,
      raw: payload
    })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    })
  }
}
