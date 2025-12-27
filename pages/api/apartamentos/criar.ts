import type { NextApiRequest, NextApiResponse } from 'next'
import { criarApartamento, atualizarApartamento, excluirApartamento } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const apartamento = await criarApartamento(req.body)
      return res.status(201).json(apartamento)
    }
    
    if (req.method === 'PUT') {
      const { uid, ...data } = req.body
      if (!uid) return res.status(400).json({ error: 'uid é obrigatório' })
      const apartamento = await atualizarApartamento(uid, data)
      return res.status(200).json(apartamento)
    }
    
    if (req.method === 'DELETE') {
      const { uid } = req.body
      if (!uid) return res.status(400).json({ error: 'uid é obrigatório' })
      await excluirApartamento(uid)
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Erro em apartamentos:', error)
    return res.status(500).json({ error: error.message || 'Erro interno' })
  }
}
