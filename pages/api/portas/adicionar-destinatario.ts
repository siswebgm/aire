import type { NextApiRequest, NextApiResponse } from 'next'
import { adicionarDestinatario } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid, condominioUid, destinatario, usuarioUid } = req.body

  if (!portaUid || !condominioUid || !destinatario) {
    return res.status(400).json({ error: 'Dados incompletos' })
  }

  if (!destinatario.bloco || !destinatario.apartamento) {
    return res.status(400).json({ error: 'Bloco e apartamento são obrigatórios' })
  }

  try {
    const result = await adicionarDestinatario(portaUid, condominioUid, destinatario, usuarioUid)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Erro ao adicionar destinatário:', error)
    return res.status(500).json({ error: error.message || 'Erro ao adicionar destinatário' })
  }
}
