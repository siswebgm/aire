import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../src/lib/supabaseClient'
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
    if (!condominioUid) {
      return res.status(400).json({ error: 'condominioUid é obrigatório' })
    }

    console.log(`[TESTE] Testando gaveteiros para condomínio ${condominioUid}`)

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
    console.log(`[TESTE] Usando ESP32 IP: ${esp32Ip}`)

    // 2. Buscar todas as portas do condomínio
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

    console.log(`[TESTE] Encontradas ${portas.length} portas para testar`)

    // 3. Testar porta específica ou todas
    const portasParaTestar = numeroPorta 
      ? portas.filter(p => p.numero_porta === numeroPorta)
      : portas

    if (portasParaTestar.length === 0) {
      return res.status(404).json({ error: 'Porta especificada não encontrada' })
    }

    const resultados = []

    // 4. Testar cada porta
    for (const porta of portasParaTestar) {
      const portaNumero = porta.numero_porta
      
      try {
        // Gerar token de segurança
        const tokenData = `${condominioUid}:${porta.uid}:${portaNumero}:AIRE_2025_SUPER_SECRETO`
        const securityToken = crypto.createHash('sha256').update(tokenData).digest('hex')
        
        // Construir URL
        const esp32Url = `http://${esp32Ip}/abrir?condominio_uid=${condominioUid}&porta_uid=${porta.uid}&porta=${portaNumero}&token=${securityToken}`
        
        console.log(`[TESTE] Testando porta ${portaNumero}: ${esp32Url}`)
        
        // Enviar requisição
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(esp32Url, {
          method: 'GET',
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        const esp32Response = await response.text()
        
        // Verificar se a porta foi aberta com sucesso
        const portaAberta = response.ok && (
          esp32Response.includes('ABERTA') || 
          esp32Response.includes('aberta') || 
          esp32Response.includes('ok') ||
          esp32Response.includes('success')
        )

        resultados.push({
          porta: portaNumero,
          portaUid: porta.uid,
          status: porta.status_atual,
          gaveteiro: (porta as any).gaveteiro?.nome || 'Não identificado',
          sucesso: portaAberta,
          resposta: esp32Response,
          url: esp32Url,
          erro: portaAberta ? null : `Status ${response.status}: ${esp32Response}`
        })

        console.log(`[TESTE] Porta ${portaNumero}: ${portaAberta ? 'SUCESSO' : 'FALHA'} - ${esp32Response}`)

      } catch (error: any) {
        console.error(`[TESTE] Erro ao testar porta ${portaNumero}:`, error.message)
        
        resultados.push({
          porta: portaNumero,
          portaUid: porta.uid,
          status: porta.status_atual,
          gaveteiro: (porta as any).gaveteiro?.nome || 'Não identificado',
          sucesso: false,
          resposta: null,
          url: null,
          erro: error.message || 'Erro de conexão'
        })
      }
    }

    // 5. Retornar resultados
    const sucessoCount = resultados.filter(r => r.sucesso).length
    const falhaCount = resultados.length - sucessoCount

    return res.status(200).json({
      success: true,
      message: `Teste concluído: ${sucessoCount} portas abertas com sucesso, ${falhaCount} falhas`,
      condominio: condominio.nome,
      esp32Ip: esp32Ip,
      totalPortas: portas.length,
      portasTestadas: resultados.length,
      resultados: resultados,
      resumo: {
        sucesso: sucessoCount,
        falha: falhaCount,
        taxaSucesso: resultados.length > 0 ? (sucessoCount / resultados.length * 100).toFixed(1) : '0'
      }
    })

  } catch (error) {
    console.error('[TESTE] Erro geral:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
}
