import type { NextApiRequest, NextApiResponse } from 'next'
import { criarCondominio } from '../../../lib/server/gaveteiroServiceComplete'

const trimOrNull = (v: any) => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      nome,
      documento,
      descricao,
      senha_mestre,
      wifi_login,
      wifi_senha,
      esp32_ip,
      nome_fantasia,
      storage
    } = req.body || {}

    const nomeNorm = trimOrNull(nome)
    if (!nomeNorm) {
      return res.status(400).json({ error: 'Nome é obrigatório' })
    }

    const esp32IpNorm = trimOrNull(esp32_ip)
    if (esp32IpNorm && esp32IpNorm.length > 45) {
      return res.status(400).json({ error: 'esp32_ip inválido' })
    }

    const condominio = await criarCondominio({
      nome: nomeNorm,
      documento: trimOrNull(documento),
      descricao: trimOrNull(descricao),
      senha_mestre: trimOrNull(senha_mestre),
      wifi_login: trimOrNull(wifi_login),
      wifi_senha: trimOrNull(wifi_senha),
      esp32_ip: esp32IpNorm,
      nome_fantasia: trimOrNull(nome_fantasia),
      storage: trimOrNull(storage),
      ativo: true
    } as any)

    return res.status(201).json({ success: true, condominio: { uid: (condominio as any).uid } })
  } catch (e: any) {
    console.error('Erro ao cadastrar condominio:', e)
    return res.status(500).json({ error: e?.message || 'Erro ao cadastrar' })
  }
}
