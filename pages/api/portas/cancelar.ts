import type { NextApiRequest, NextApiResponse } from 'next'
import { cancelarOcupacao } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid, condominioUid, motivo, usuarioUid } = req.body

  if (!portaUid || !condominioUid || !motivo) {
    return res.status(400).json({ error: 'Dados incompletos' })
  }

  try {
    const result = await cancelarOcupacao(portaUid, condominioUid, motivo, usuarioUid)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Erro ao cancelar ocupação:', error)
    return res.status(500).json({ error: error.message || 'Erro ao cancelar ocupação' })
  }
}
