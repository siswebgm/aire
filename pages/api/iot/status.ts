import type { NextApiRequest, NextApiResponse } from 'next'
import { consultarComandoIot } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { comandoUid } = req.query

  if (!comandoUid || typeof comandoUid !== 'string') {
    return res.status(400).json({ error: 'comandoUid é obrigatório' })
  }

  try {
    const comando = await consultarComandoIot(comandoUid)
    if (!comando) {
      return res.status(404).json({ error: 'Comando não encontrado' })
    }
    return res.status(200).json(comando)
  } catch (error: any) {
    console.error('Erro ao consultar comando IoT:', error)
    return res.status(500).json({ error: error.message || 'Erro ao consultar comando' })
  }
}
