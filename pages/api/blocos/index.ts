import type { NextApiRequest, NextApiResponse } from 'next'
import { listarBlocos } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const blocos = await listarBlocos(condominioUid)
    return res.status(200).json(blocos)
  } catch (error) {
    console.error('Erro ao listar blocos:', error)
    return res.status(500).json({ error: 'Erro ao buscar blocos' })
  }
}
