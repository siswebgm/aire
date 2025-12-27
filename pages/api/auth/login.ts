import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '../../../lib/server/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, senha } = req.body

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' })
  }

  try {
    const { data: usuarios, error } = await supabaseServer
      .from('gvt_usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('ativo', true)
      .limit(1)

    if (error) {
      console.error('Erro ao buscar usuário:', error)
      return res.status(500).json({ error: 'Erro ao conectar com o servidor' })
    }

    if (!usuarios || usuarios.length === 0) {
      return res.status(401).json({ error: 'Email não encontrado' })
    }

    const user = usuarios[0]

    if (user.senha_hash !== senha) {
      return res.status(401).json({ error: 'Senha incorreta' })
    }

    const { data: condominioData, error: condError } = await supabaseServer
      .from('gvt_condominios')
      .select('*')
      .eq('uid', user.condominio_uid)
      .single()

    if (condError || !condominioData) {
      return res.status(500).json({ error: 'Erro ao carregar dados do condomínio' })
    }

    await supabaseServer
      .from('gvt_usuarios')
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq('uid', user.uid)

    const userWithoutPassword = { ...user, senha_hash: undefined }

    return res.status(200).json({
      success: true,
      usuario: userWithoutPassword,
      condominio: condominioData
    })
  } catch (err) {
    console.error('Erro no login:', err)
    return res.status(500).json({ error: 'Erro inesperado' })
  }
}
