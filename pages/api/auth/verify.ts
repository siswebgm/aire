import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '../../../lib/server/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { usuarioUid } = req.body

  if (!usuarioUid) {
    return res.status(400).json({ error: 'UID do usuário é obrigatório' })
  }

  try {
    const { data: usuarioAtualizado, error: userError } = await supabaseServer
      .from('gvt_usuarios')
      .select('*')
      .eq('uid', usuarioUid)
      .eq('ativo', true)
      .single()

    if (userError || !usuarioAtualizado) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' })
    }

    const { data: condominioAtualizado, error: condError } = await supabaseServer
      .from('gvt_condominios')
      .select('*')
      .eq('uid', usuarioAtualizado.condominio_uid)
      .single()

    if (condError || !condominioAtualizado) {
      return res.status(500).json({ error: 'Erro ao carregar condomínio' })
    }

    const userWithoutPassword = { ...usuarioAtualizado, senha_hash: undefined }

    return res.status(200).json({
      success: true,
      usuario: userWithoutPassword,
      condominio: condominioAtualizado
    })
  } catch (err) {
    console.error('Erro ao verificar sessão:', err)
    return res.status(500).json({ error: 'Erro inesperado' })
  }
}
