import type { NextApiRequest, NextApiResponse } from 'next'
import { liberarPortaComSenha } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid, condominioUid, senha, usuarioUid } = req.body

  if (!portaUid || !condominioUid || !senha) {
    return res.status(400).json({ error: 'Dados incompletos' })
  }

  try {
    const result = await liberarPortaComSenha(portaUid, condominioUid, senha, usuarioUid)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Erro ao liberar porta:', error)
    return res.status(500).json({ error: error.message || 'Erro ao liberar porta' })
  }
}
