import type { NextApiRequest, NextApiResponse } from 'next'
import { listarCondominios } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const condominios = await listarCondominios()
    return res.status(200).json(condominios)
  } catch (error) {
    console.error('Erro ao listar condominios:', error)
    return res.status(500).json({ error: 'Erro ao buscar condominios' })
  }
}
