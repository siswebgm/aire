import type { NextApiRequest, NextApiResponse } from 'next'
import { listarPortas } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { gaveteiroUid } = req.query

  if (!gaveteiroUid || typeof gaveteiroUid !== 'string') {
    return res.status(400).json({ error: 'gaveteiroUid é obrigatório' })
  }

  try {
    const portas = await listarPortas(gaveteiroUid)
    return res.status(200).json(portas)
  } catch (error) {
    console.error('Erro ao listar portas:', error)
    return res.status(500).json({ error: 'Erro ao buscar portas' })
  }
}
