import type { NextApiRequest, NextApiResponse } from 'next'
import { obterEstatisticasArmario } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const estatisticas = await obterEstatisticasArmario(condominioUid)
    return res.status(200).json(estatisticas)
  } catch (error: any) {
    console.error('Erro ao obter estatísticas:', error)
    return res.status(500).json({ error: error.message || 'Erro ao obter estatísticas' })
  }
}