import type { NextApiRequest, NextApiResponse } from 'next'
import { validarSenhaCompleta } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { senha, condominioUid } = req.body

  if (!senha) {
    return res.status(400).json({ error: 'Senha é obrigatória' })
  }

  try {
    const result = await validarSenhaCompleta(senha, condominioUid)
    
    if (result.tipo === 'INVALIDA') {
      return res.status(404).json({ error: 'Senha inválida ou já utilizada' })
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Erro ao validar senha:', error)
    return res.status(500).json({ error: 'Erro ao validar senha' })
  }
}
