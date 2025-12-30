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
    const { condominioUid, numeroPorta, motivo } = req.body

    // Validações
    if (!condominioUid || !numeroPorta) {
      return res.status(400).json({ error: 'condominioUid e numeroPorta são obrigatórios' })
    }

    console.log(`[TOTEM] Cancelando porta ${numeroPorta} para condomínio ${condominioUid}`)

    // 1. Consultar porta atual
    const { data: porta, error: portaError } = await supabase
      .from('gvt_portas')
      .select('*')
      .eq('condominio_uid', condominioUid)
      .eq('numero_porta', numeroPorta)
      .single()

    if (portaError || !porta) {
      return res.status(404).json({ error: 'Porta não encontrada' })
    }

    console.log(`[TOTEM] Porta encontrada: UID=${porta.uid}, Status atual=${porta.status_atual}`)

    // 2. Cancelar todas as senhas provisórias ativas da porta
    try {
      const { error: senhasError } = await supabase
        .from('gvt_senhas_provisorias')
        .update({ status: 'CANCELADA' })
        .eq('porta_uid', porta.uid)
        .eq('status', 'ATIVA')

      if (senhasError) {
        console.warn('[TOTEM] Aviso: erro ao cancelar senhas:', senhasError)
      } else {
        console.log(`[TOTEM] Senhas da porta ${numeroPorta} canceladas`)
      }
    } catch (error) {
      console.warn('[TOTEM] Erro ao cancelar senhas:', error)
      // Não falha a operação se não conseguir cancelar senhas
    }

    // 3. Atualizar status da porta para DISPONIVEL
    const agora = new Date().toISOString()
    
    const { error: updateError } = await supabase
      .from('gvt_portas')
      .update({
        status_atual: 'DISPONIVEL',
        ultimo_evento_em: agora,
        finalizado_em: agora,
        // Limpar dados do ocupante
        bloco_atual: null,
        apartamento_atual: null,
        compartilhada: false
      })
      .eq('uid', porta.uid)

    if (updateError) {
      console.error('[TOTEM] Erro ao atualizar status da porta:', updateError)
      return res.status(500).json({ 
        error: `Erro ao atualizar status da porta: ${updateError.message}`
      })
    }

    console.log(`[TOTEM] Porta ${numeroPorta} atualizada para DISPONIVEL`)

    // 4. Registrar movimentação de cancelamento
    try {
      await supabase
        .from('gvt_movimentacoes_porta')
        .insert({
          porta_uid: porta.uid,
          condominio_uid: condominioUid,
          acao: 'CANCELAR_TOTEM',
          status_resultante: 'DISPONIVEL',
          origem: 'TOTEM',
          observacao: motivo || `Cancelamento via Totem - Porta ${numeroPorta}`
        })
      console.log(`[TOTEM] Movimentação de cancelamento registrada`)
    } catch (movError) {
      console.warn('[TOTEM] Aviso: não foi possível registrar movimentação:', movError)
      // Não falha a operação se não conseguir registrar movimentação
    }

    return res.status(200).json({
      success: true,
      message: 'Porta cancelada e liberada com sucesso!',
      portaUid: porta.uid,
      numeroPorta: numeroPorta,
      statusAnterior: porta.status_atual
    })

  } catch (error) {
    console.error('[TOTEM] Erro geral:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
}
