import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../src/lib/supabaseClient'
import crypto from 'crypto'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { condominioUid, numeroPorta } = req.body

    // Validações
    if (!condominioUid || !numeroPorta) {
      return res.status(400).json({ error: 'condominioUid e numeroPorta são obrigatórios' })
    }

    console.log(`[TOTEM] Confirmando porta ${numeroPorta} para condomínio ${condominioUid}`)

    // 1. Consultar tabela gvt_portas com os filtros especificados
    const { data: porta, error: portaError } = await supabase
      .from('gvt_portas')
      .select('*')
      .eq('condominio_uid', condominioUid)
      .eq('numero_porta', numeroPorta)
      .eq('ativo', true)
      .single()

    if (portaError || !porta) {
      console.error('[TOTEM] Erro ao buscar porta:', portaError)
      return res.status(404).json({ error: 'Porta não encontrada' })
    }

    console.log(`[TOTEM] Porta encontrada: UID=${porta.uid}, Status=${porta.status_atual}, Gaveteiro=${porta.gaveteiro_uid}`)

    // Verificar se a porta está disponível
    if (porta.status_atual !== 'DISPONIVEL') {
      console.warn(`[TOTEM] Porta ${numeroPorta} não está disponível. Status atual: ${porta.status_atual}`)
      return res.status(400).json({ error: 'Porta não está disponível para ocupação' })
    }

    // 2. Gerar token de segurança SHA256
    const tokenData = `${condominioUid}:${porta.uid}:${numeroPorta}:AIRE_2025_SUPER_SECRETO`
    const securityToken = crypto.createHash('sha256').update(tokenData).digest('hex')
    
    console.log(`[TOTEM] Token gerado para porta ${numeroPorta}`)

    // 3. Buscar IP do ESP32 na tabela do condomínio
    console.log(`[TOTEM] Buscando condomínio UID: ${condominioUid}`)
    
    const { data: condominio, error: condominioError } = await supabase
      .from('gvt_condominios')
      .select('esp32_ip, nome, uid')
      .eq('uid', condominioUid)
      .single()

    console.log(`[TOTEM] Resultado busca condomínio:`, { condominio, condominioError })

    if (condominioError || !condominio) {
      console.error('[TOTEM] Erro na busca do condomínio:', condominioError)
      return res.status(400).json({ error: `Condomínio não encontrado: ${condominioError?.message || 'UID inválido'}` })
    }

    const esp32Ip = String(condominio.esp32_ip || '').trim()
    if (!esp32Ip) {
      return res.status(400).json({
        success: false,
        error: 'ESP32 não configurado para este condomínio. Configure o campo esp32_ip em gvt_condominios.'
      })
    }

    console.log(`[TOTEM] IP do condomínio "${condominio.nome}": ${esp32Ip}`)

    // Verificar se é IP local ou público
    const isLocalIP = esp32Ip.startsWith('192.168.') || 
                      esp32Ip.startsWith('10.') || 
                      esp32Ip.startsWith('172.') ||
                      esp32Ip === 'localhost' ||
                      esp32Ip.startsWith('127.')

    let esp32Url: string
    if (isLocalIP) {
      // Se for IP local, avisar que só funciona na mesma rede
      esp32Url = `http://${esp32Ip}/abrir?condominio_uid=${condominioUid}&porta_uid=${porta.uid}&porta=${numeroPorta}&token=${securityToken}`
      console.log(`[TOTEM] Aviso: Usando IP local - só funciona na mesma rede`)
      console.log(`[TOTEM] Para acesso externo, configure port forwarding no roteador`)
    } else {
      // Já é IP público
      esp32Url = `http://${esp32Ip}/abrir?condominio_uid=${condominioUid}&porta_uid=${porta.uid}&porta=${numeroPorta}&token=${securityToken}`
      console.log(`[TOTEM] Usando IP público: ${esp32Ip}`)
    }
    
    console.log(`[TOTEM] URL completa: ${esp32Url}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let esp32Response: string
    let portaAberta = false

    try {
      const response = await fetch(esp32Url, {
        method: 'GET',
        signal: controller.signal
      })

      esp32Response = await response.text()
      console.log(`[TOTEM] Resposta ESP32 (${response.status}):`, esp32Response)

      // Verificar se a porta foi aberta com sucesso
      portaAberta = response.ok && (
        esp32Response.includes('ABERTA') || 
        esp32Response.includes('aberta') || 
        esp32Response.includes('ok') ||
        esp32Response.includes('success')
      )

    } catch (error: any) {
      console.error('[TOTEM] Erro ao comunicar com ESP32:', error)
      esp32Response = error?.message || 'Erro desconhecido'
    } finally {
      clearTimeout(timeoutId)
    }

    // 5. Atualizar status da porta para OCUPADA (apenas se a abertura foi bem-sucedida)
    if (portaAberta) {
      const agora = new Date().toISOString()
      
      console.log(`[TOTEM] Atualizando porta ${porta.uid} para OCUPADO`)
      
      const { error: updateError } = await supabase
        .from('gvt_portas')
        .update({
          status_atual: 'OCUPADO', // Mudado de OCUPADA para OCUPADO
          ultimo_evento_em: agora,
          ocupado_em: agora
        })
        .eq('uid', porta.uid)

      if (updateError) {
        console.error('[TOTEM] Erro ao atualizar status da porta:', updateError)
        console.error('[TOTEM] Detalhes do erro:', JSON.stringify(updateError, null, 2))
        return res.status(500).json({ 
          error: `Erro ao atualizar status da porta: ${updateError.message}`,
          details: updateError
        })
      }

      console.log(`[TOTEM] Porta ${numeroPorta} atualizada para OCUPADO com sucesso`)

      // Registrar movimentação
      try {
        await supabase
          .from('gvt_movimentacoes_porta')
          .insert({
            porta_uid: porta.uid,
            condominio_uid: condominioUid,
            acao: 'ABRIR_TOTEM',
            status_resultante: 'OCUPADO', // Mudado de OCUPADA para OCUPADO
            origem: 'TOTEM',
            observacao: `Porta aberta via Totem - Token: ${securityToken.substring(0, 8)}...`
          })
        console.log(`[TOTEM] Movimentação registrada com sucesso`)
      } catch (movError) {
        console.warn('[TOTEM] Aviso: não foi possível registrar movimentação:', movError)
        // Não falha a operação se não conseguir registrar movimentação
      }

      return res.status(200).json({
        success: true,
        message: 'Porta aberta e ocupada com sucesso!',
        portaUid: porta.uid,
        numeroPorta: numeroPorta,
        securityToken: securityToken,
        esp32Response: esp32Response,
        esp32Url: esp32Url
      })

    } else {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível abrir a porta',
        portaUid: porta.uid,
        numeroPorta: numeroPorta,
        securityToken: securityToken,
        esp32Response: esp32Response,
        esp32Url: esp32Url
      })
    }

  } catch (error) {
    console.error('[TOTEM] Erro geral:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
}
