import type { NextApiRequest, NextApiResponse } from 'next'
import { obterRelatorioBlocoApartamento } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, bloco, apartamento } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const relatorio = await obterRelatorioBlocoApartamento(
      condominioUid,
      typeof bloco === 'string' ? bloco : undefined,
      typeof apartamento === 'string' ? apartamento : undefined
    )
    return res.status(200).json(relatorio)
  } catch (error: any) {
    console.error('Erro ao obter relatório por bloco:', error)
    return res.status(500).json({ error: error.message || 'Erro ao obter relatório' })
  }
}
