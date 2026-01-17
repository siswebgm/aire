import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid } = req.body || {}

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
  const host = req.headers.host
  const baseUrl = `${proto}://${host}`
  const url = `${baseUrl}/cadastro-morador?condominioUid=${encodeURIComponent(condominioUid)}`

  return res.status(200).json({ url })
}
