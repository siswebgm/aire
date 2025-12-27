import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid, limite } = req.query

  if (!portaUid || typeof portaUid !== 'string') {
    return res.status(400).json({ error: 'portaUid é obrigatório' })
  }

  try {
    const { listarMovimentacoes } = await import('../../../src/services/gaveteiroService')
    
    const movimentacoes = await listarMovimentacoes(
      portaUid,
      limite ? parseInt(limite as string) : 50
    )

    return res.status(200).json(movimentacoes)
  } catch (error: any) {
    console.error('Erro ao listar movimentações:', error)
    return res.status(500).json({ error: 'Erro ao buscar movimentações' })
  }
}
