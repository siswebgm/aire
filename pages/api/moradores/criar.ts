import type { NextApiRequest, NextApiResponse } from 'next'
import { criarMorador, atualizarMorador, excluirMorador } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const morador = await criarMorador(req.body)
      return res.status(201).json(morador)
    }
    
    if (req.method === 'PUT') {
      const { uid, ...data } = req.body
      if (!uid) return res.status(400).json({ error: 'uid é obrigatório' })
      const morador = await atualizarMorador(uid, data)
      return res.status(200).json(morador)
    }
    
    if (req.method === 'DELETE') {
      const { uid } = req.body
      if (!uid) return res.status(400).json({ error: 'uid é obrigatório' })
      await excluirMorador(uid)
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Erro em moradores:', error)
    return res.status(500).json({ error: error.message || 'Erro interno' })
  }
}
