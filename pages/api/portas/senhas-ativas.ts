import type { NextApiRequest, NextApiResponse } from 'next'
import { buscarSenhasAtivas } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid } = req.query

  if (!portaUid || typeof portaUid !== 'string') {
    return res.status(400).json({ error: 'portaUid é obrigatório' })
  }

  try {
    const senhas = await buscarSenhasAtivas(portaUid)
    return res.status(200).json(senhas)
  } catch (error) {
    console.error('Erro ao buscar senhas ativas:', error)
    return res.status(500).json({ error: 'Erro ao buscar senhas' })
  }
}
