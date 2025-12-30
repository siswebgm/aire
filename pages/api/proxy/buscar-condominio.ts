import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../src/lib/supabaseClient'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { condominioUid } = req.body

    // Validações
    if (!condominioUid) {
      return res.status(400).json({ error: 'condominioUid é obrigatório' })
    }

    console.log(`[BUSCAR] Buscando informações do condomínio ${condominioUid}`)

    // Buscar informações do condomínio usando Supabase client
    const { data: condominio, error: condominioError } = await supabase
      .from('gvt_condominios')
      .select('nome, esp32_ip, uid')
      .eq('uid', condominioUid)
      .single()

    if (condominioError || !condominio) {
      console.error('[BUSCAR] Erro ao buscar condomínio:', condominioError)
      return res.status(404).json({ error: 'Condomínio não encontrado' })
    }

    console.log(`[BUSCAR] Condomínio encontrado: ${condominio.nome}`)

    return res.status(200).json({
      success: true,
      nome: condominio.nome,
      esp32Ip: condominio.esp32_ip,
      uid: condominio.uid
    })

  } catch (error) {
    console.error('[BUSCAR] Erro geral:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
}
