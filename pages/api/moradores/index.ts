import type { NextApiRequest, NextApiResponse } from 'next'
import { listarMoradores } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const moradores = await listarMoradores(condominioUid)
    return res.status(200).json(moradores)
  } catch (error) {
    console.error('Erro ao listar moradores:', error)
    return res.status(500).json({ error: 'Erro ao buscar moradores' })
  }
}
