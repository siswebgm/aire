import type { NextApiRequest, NextApiResponse } from 'next'
import { listarApartamentos } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, blocoUid } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const apartamentos = await listarApartamentos(
      condominioUid,
      typeof blocoUid === 'string' ? blocoUid : undefined
    )
    return res.status(200).json(apartamentos)
  } catch (error) {
    console.error('Erro ao listar apartamentos:', error)
    return res.status(500).json({ error: 'Erro ao buscar apartamentos' })
  }
}
