import type { NextApiRequest, NextApiResponse } from 'next'
import { darBaixaPorta } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid, condominioUid, usuarioUid } = req.body

  if (!portaUid || !condominioUid) {
    return res.status(400).json({ error: 'portaUid e condominioUid são obrigatórios' })
  }

  try {
    await darBaixaPorta(portaUid, condominioUid, usuarioUid)
    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Erro ao dar baixa na porta:', error)
    return res.status(500).json({ error: error.message || 'Erro ao dar baixa' })
  }
}
