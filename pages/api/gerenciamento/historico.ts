import type { NextApiRequest, NextApiResponse } from 'next'
import { obterHistoricoMovimentacoes } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, portaUid, bloco, apartamento, dataInicio, dataFim, limite } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const historico = await obterHistoricoMovimentacoes(condominioUid, {
      portaUid: typeof portaUid === 'string' ? portaUid : undefined,
      bloco: typeof bloco === 'string' ? bloco : undefined,
      apartamento: typeof apartamento === 'string' ? apartamento : undefined,
      dataInicio: typeof dataInicio === 'string' ? dataInicio : undefined,
      dataFim: typeof dataFim === 'string' ? dataFim : undefined,
      limite: typeof limite === 'string' ? parseInt(limite) : undefined
    })
    return res.status(200).json(historico)
  } catch (error: any) {
    console.error('Erro ao obter histórico:', error)
    return res.status(500).json({ error: error.message || 'Erro ao obter histórico' })
  }
}
