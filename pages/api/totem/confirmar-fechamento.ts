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

    const { data: porta, error: portaError } = await supabase
      .from('gvt_portas')
      .select('uid')
      .eq('condominio_uid', condominioUid)
      .eq('numero_porta', numeroPorta)
      .single()

    if (portaError || !porta) {
      return res.status(404).json({ error: 'Porta não encontrada' })
    }

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('gvt_portas')
      .update({
        sensor_ima_status: 'fechado',
        sensor_ima_atualizado_em: now
      })
      .eq('uid', porta.uid)

    if (updateError) {
      return res.status(500).json({ error: 'Erro ao confirmar fechamento no banco' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    })
  }
}
