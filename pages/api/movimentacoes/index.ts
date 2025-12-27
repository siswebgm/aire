import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '../../../lib/server/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, limit = '1000' } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const { data, error } = await supabaseServer
      .from('gvt_movimentacoes_porta')
      .select(`uid, porta_uid, tipo_acao, status_resultante, bloco, apartamento, destinatarios, created_at,
        porta:gvt_portas(numero_porta, gaveteiro:gvt_gaveteiros(nome))`)
      .eq('condominio_uid', condominioUid)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string, 10))

    if (error) throw error

    return res.status(200).json(data || [])
  } catch (error) {
    console.error('Erro ao listar movimentações:', error)
    return res.status(500).json({ error: 'Erro ao buscar movimentações' })
  }
}
