import { NextApiRequest, NextApiResponse } from 'next'

const WEBHOOK_URL = 'https://whkn8n.guardia.work/webhook/aire-notificar-entregador'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const {
      whatsapp,
      comprovanteUrl,
      comprovantePayload,
      condominioUid,
      numeroPorta
    } = (req.body || {}) as {
      whatsapp?: string
      comprovanteUrl?: string
      comprovantePayload?: any
      condominioUid?: string
      numeroPorta?: number
    }

    if (!whatsapp) {
      return res.status(400).json({ error: 'whatsapp é obrigatório' })
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        whatsapp,
        comprovante_url: comprovanteUrl || null,
        comprovante: comprovantePayload || null,
        condominio_uid: condominioUid || null,
        numero_porta: numeroPorta || null,
        enviado_em: new Date().toISOString()
      })
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return res.status(502).json({
        error: 'Falha ao enviar webhook',
        details: text || `status ${response.status}`
      })
    }

    const data = await response.json().catch(() => null)
    return res.status(200).json({ success: true, data })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    })
  }
}
