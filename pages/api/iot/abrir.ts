import type { NextApiRequest, NextApiResponse } from 'next'
import { solicitarAberturaPortaIot, consultarComandoIot } from '../../../lib/server/gaveteiroServiceComplete'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { deviceId, portaNumero, pulseMs, token } = req.body

  if (!deviceId || !portaNumero) {
    return res.status(400).json({ error: 'deviceId e portaNumero são obrigatórios' })
  }

  try {
    const comando = await solicitarAberturaPortaIot({ deviceId, portaNumero, pulseMs, token })
    return res.status(200).json(comando)
  } catch (error: any) {
    console.error('Erro ao solicitar abertura IoT:', error)
    return res.status(500).json({ error: error.message || 'Erro ao solicitar abertura' })
  }
}
