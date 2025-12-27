import type { NextApiRequest, NextApiResponse } from 'next'
import { obterEstatisticasPorPeriodo } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, periodo } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  const periodoValido = ['dia', 'semana', 'mes', 'ano'].includes(periodo as string) 
    ? (periodo as 'dia' | 'semana' | 'mes' | 'ano') 
    : 'dia'

  try {
    const estatisticas = await obterEstatisticasPorPeriodo(condominioUid, periodoValido)
    return res.status(200).json(estatisticas)
  } catch (error: any) {
    console.error('Erro ao obter estatísticas por período:', error)
    return res.status(500).json({ error: error.message || 'Erro ao obter estatísticas' })
  }
}
