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

    const msg = error?.message || 'Erro ao ocupar porta'
    const isMoradorValidation =
      typeof msg === 'string' &&
      (msg.startsWith('Não existe morador cadastrado') || msg.startsWith('Não existem moradores cadastrados'))

    return res.status(isMoradorValidation ? 400 : 500).json({ error: msg })
  }
}
