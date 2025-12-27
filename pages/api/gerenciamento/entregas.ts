import type { NextApiRequest, NextApiResponse } from 'next'
import { listarEntregasGerenciamento } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, status, bloco, apartamento, dataInicio, dataFim } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const entregas = await listarEntregasGerenciamento(condominioUid, {
      status: typeof status === 'string' ? status : undefined,
      bloco: typeof bloco === 'string' ? bloco : undefined,
      apartamento: typeof apartamento === 'string' ? apartamento : undefined,
      dataInicio: typeof dataInicio === 'string' ? dataInicio : undefined,
      dataFim: typeof dataFim === 'string' ? dataFim : undefined
    })
    return res.status(200).json(entregas)
  } catch (error: any) {
    console.error('Erro ao listar entregas:', error)
    return res.status(500).json({ error: error.message || 'Erro ao listar entregas' })
  }
}