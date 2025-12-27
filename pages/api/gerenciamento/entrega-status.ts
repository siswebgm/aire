import type { NextApiRequest, NextApiResponse } from 'next'
import { atualizarStatusEntrega } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { entregaUid, novoStatus, usuarioUid } = req.body

  if (!entregaUid || !novoStatus) {
    return res.status(400).json({ error: 'entregaUid e novoStatus são obrigatórios' })
  }

  try {
    await atualizarStatusEntrega(entregaUid, novoStatus, usuarioUid)
    return res.status(200).json({ sucesso: true, mensagem: 'Status atualizado com sucesso' })
  } catch (error: any) {
    console.error('Erro ao atualizar status da entrega:', error)
    return res.status(500).json({ error: error.message || 'Erro ao atualizar status' })
  }
}
