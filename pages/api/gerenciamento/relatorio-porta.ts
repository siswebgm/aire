import type { NextApiRequest, NextApiResponse } from 'next'
import { obterRelatorioPorta } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { portaUid } = req.query

  if (!portaUid || typeof portaUid !== 'string') {
    return res.status(400).json({ error: 'portaUid é obrigatório' })
  }

  try {
    const relatorio = await obterRelatorioPorta(portaUid)
    if (!relatorio) {
      return res.status(404).json({ error: 'Porta não encontrada' })
    }
    return res.status(200).json(relatorio)
  } catch (error: any) {
    console.error('Erro ao obter relatório da porta:', error)
    return res.status(500).json({ error: error.message || 'Erro ao obter relatório' })
  }
}
