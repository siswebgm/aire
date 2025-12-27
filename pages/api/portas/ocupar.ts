import type { NextApiRequest, NextApiResponse } from 'next'
import { ocuparPorta } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid, condominioUid, destinatarios, usuarioUid, observacao } = req.body

  if (!portaUid || !condominioUid || !destinatarios || destinatarios.length === 0) {
    return res.status(400).json({ error: 'Dados incompletos' })
  }

  try {
    const result = await ocuparPorta({
      portaUid,
      condominioUid,
      destinatarios,
      usuarioUid,
      observacao
    })

    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Erro ao ocupar porta:', error)
    return res.status(500).json({ error: error.message || 'Erro ao ocupar porta' })
  }
}
