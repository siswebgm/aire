import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '../../../lib/server/supabase'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { condominioUid, esp32Ip } = req.body as {
      condominioUid?: string
      esp32Ip?: string
    }

    if (!condominioUid) {
      return res.status(400).json({ error: 'condominioUid é obrigatório' })
    }

    if (!esp32Ip || !String(esp32Ip).trim()) {
      return res.status(400).json({ error: 'esp32Ip é obrigatório' })
    }

    const ip = String(esp32Ip).trim()

    const { data, error } = await supabaseServer
      .from('gvt_condominios')
      .update({
        esp32_ip: ip,
      })
      .eq('uid', condominioUid)
      .select('uid')

    if (error) {
      console.error('[ATUALIZAR-IP] Erro ao atualizar esp32_ip:', error)
      return res.status(500).json({
        error: error.message || 'Erro ao atualizar IP no banco',
        details: error,
      })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Condomínio não encontrado para atualizar' })
    }

    return res.status(200).json({ success: true, esp32Ip: ip })
  } catch (error) {
    console.error('[ATUALIZAR-IP] Erro geral:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
    })
  }
}
