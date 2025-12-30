import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../src/lib/supabaseClient'

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

    console.log(`[BUSCAR_PORTAS] Buscando portas para condomínio ${condominioUid}`)

    // 1. Buscar informações do condomínio
    const { data: condominio, error: condominioError } = await supabase
      .from('gvt_condominios')
      .select('esp32_ip, nome, uid')
      .eq('uid', condominioUid)
      .single()

    if (condominioError || !condominio) {
      return res.status(400).json({ error: 'Condomínio não encontrado' })
    }

    const esp32Ip = condominio.esp32_ip || '192.168.1.76'
    console.log(`[BUSCAR_PORTAS] Condomínio: ${condominio.nome}, ESP32: ${esp32Ip}`)

    // 2. Buscar todas as portas do condomínio (sem testar)
    const { data: portas, error: portasError } = await supabase
      .from('gvt_portas')
      .select('uid, numero_porta, status_atual, gaveteiro_uid, gaveteiro:gvt_gaveteiros(nome, codigo_hardware)')
      .eq('condominio_uid', condominioUid)
      .eq('ativo', true)
      .order('numero_porta', { ascending: true })

    if (portasError) {
      return res.status(500).json({ error: 'Erro ao buscar portas' })
    }

    if (!portas || portas.length === 0) {
      return res.status(404).json({ error: 'Nenhuma porta encontrada' })
    }

    console.log(`[BUSCAR_PORTAS] Encontradas ${portas.length} portas`)

    // 3. Retornar portas sem testar nenhuma
    const portasFormatadas = portas.map(porta => ({
      porta: porta.numero_porta,
      portaUid: porta.uid,
      status: porta.status_atual,
      gaveteiro: (porta as any).gaveteiro?.nome || 'Não identificado',
      sucesso: undefined, // undefined = não testado
      resposta: null,
      url: null,
      erro: null
    }))

    return res.status(200).json({
      success: true,
      message: `Encontradas ${portas.length} portas`,
      condominio: condominio.nome,
      esp32Ip: esp32Ip,
      totalPortas: portas.length,
      resultados: portasFormatadas
    })

  } catch (error) {
    console.error('[BUSCAR_PORTAS] Erro geral:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
}
