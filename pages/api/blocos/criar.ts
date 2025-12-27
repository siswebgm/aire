import type { NextApiRequest, NextApiResponse } from 'next'
import { criarBloco, atualizarBloco, excluirBloco } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const bloco = await criarBloco(req.body)
      return res.status(201).json(bloco)
    }
    
    if (req.method === 'PUT') {
      const { uid, ...data } = req.body
      if (!uid) return res.status(400).json({ error: 'uid é obrigatório' })
      const bloco = await atualizarBloco(uid, data)
      return res.status(200).json(bloco)
    }
    
    if (req.method === 'DELETE') {
      const { uid } = req.body
      if (!uid) return res.status(400).json({ error: 'uid é obrigatório' })
      await excluirBloco(uid)
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Erro em blocos:', error)
    return res.status(500).json({ error: error.message || 'Erro interno' })
  }
}
