import type { NextApiRequest, NextApiResponse } from 'next'
import { listarPortasGerenciamento } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    const portas = await listarPortasGerenciamento(condominioUid)
    return res.status(200).json(portas)
  } catch (error: any) {
    console.error('Erro ao listar portas:', error)
    return res.status(500).json({ error: error.message || 'Erro ao listar portas' })
  }
}