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
    const motivoFinal = motivo || `Cancelamento via Totem - Porta ${numeroPorta}`
    
    const { error: updateError } = await supabase
      .from('gvt_portas')
      .update({
        status_atual: 'DISPONIVEL',
        ultimo_evento_em: agora,
        finalizado_em: agora,
        // Limpar dados do ocupante
        bloco_atual: null,
        apartamento_atual: null,
        compartilhada: false,
        sensor_ultima_leitura: motivoFinal,
        sensor_ultima_leitura_em: agora
      })
      .eq('uid', porta.uid)

    if (updateError) {
      console.error('[TOTEM] Erro ao atualizar status da porta:', updateError)
      return res.status(500).json({ 
        error: `Erro ao atualizar status da porta: ${updateError.message}`
      })
    }

    console.log(`[TOTEM] Porta ${numeroPorta} atualizada para DISPONIVEL`)

    // 4. Atualizar movimentação existente (não criar nova linha)
    try {
      let movimentacaoExistente: any = null
      let movSelectError: any = null

      // Prioriza buscar a última movimentação ainda não cancelada.
      // Se a coluna cancelado ainda não existir (migração pendente), faz fallback.
      {
        const result = await supabase
          .from('gvt_movimentacoes_porta')
          .select('uid, observacao, acao, status_resultante')
          .eq('porta_uid', porta.uid)
          .eq('condominio_uid', condominioUid)
          .eq('status_resultante', 'OCUPADO')
          .eq('cancelado', false)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()

        movimentacaoExistente = (result as any).data
        movSelectError = (result as any).error
      }

      if (movSelectError && /cancelado/.test(String(movSelectError.message || ''))) {
        const fallback = await supabase
          .from('gvt_movimentacoes_porta')
          .select('uid, observacao, acao, status_resultante')
          .eq('porta_uid', porta.uid)
          .eq('condominio_uid', condominioUid)
          .eq('status_resultante', 'OCUPADO')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()

        movimentacaoExistente = (fallback as any).data
        movSelectError = (fallback as any).error
      }

      if (movSelectError) {
        console.warn('[TOTEM] Aviso: não foi possível buscar movimentação existente:', movSelectError)
      } else if (!movimentacaoExistente?.uid) {
        console.warn('[TOTEM] Aviso: nenhuma movimentação existente encontrada para atualizar')
      } else {
        const observacaoAnterior = (movimentacaoExistente as any).observacao || ''
        const obsAtualizada = `${observacaoAnterior}${observacaoAnterior ? ' | ' : ''}CANCELADO: ${motivoFinal}`

        const { error: movUpdateError } = await supabase
          .from('gvt_movimentacoes_porta')
          .update({
            acao: 'cancelado',
            status_resultante: 'DISPONIVEL',
            cancelado: true,
            observacao: obsAtualizada
          })
          .eq('uid', movimentacaoExistente.uid)

        if (movUpdateError) {
          console.warn('[TOTEM] Aviso: não foi possível atualizar movimentação:', movUpdateError)
        } else {
          console.log('[TOTEM] Movimentação existente atualizada para cancelado')
        }
      }
    } catch (movError) {
      console.warn('[TOTEM] Aviso: não foi possível atualizar movimentação:', movError)
      // Não falha a operação se não conseguir atualizar movimentação
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
