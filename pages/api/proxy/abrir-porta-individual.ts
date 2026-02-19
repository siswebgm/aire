import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { supabase } from '../../../src/lib/supabaseClient'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { condominioUid, portaUid, porta } = req.body

    // Validações
    if (!condominioUid || !portaUid || !porta) {
      return res.status(400).json({ error: 'condominioUid, portaUid e porta são obrigatórios' })
    }

    console.log(`[PROXY] Abrindo porta individual: ${porta} para condomínio ${condominioUid}`)

    // Buscar IP do gaveteiro e fallback do condomínio
    let portaRow: any = null
    let portaRowError: any = null

    // Primeiro tenta buscar o canal físico configurado (canal_esp32)
    {
      const { data, error } = await supabase
        .from('gvt_portas')
        .select(
          `uid,
           canal_esp32,
           gvt_gaveteiros!inner(
             uid,
             esp32_ip,
             gvt_condominios!inner(
               uid,
               esp32_ip
             )
           )`
        )
        .eq('uid', portaUid)
        .single()

      portaRow = data
      portaRowError = error
    }

    // Fallback: se a coluna ainda não existir no schema, tenta sem canal_esp32
    if (portaRowError && String(portaRowError.message || '').toLowerCase().includes('canal_esp32')) {
      const { data, error } = await supabase
        .from('gvt_portas')
        .select(
          `uid,
           gvt_gaveteiros!inner(
             uid,
             esp32_ip,
             gvt_condominios!inner(
               uid,
               esp32_ip
             )
           )`
        )
        .eq('uid', portaUid)
        .single()

      portaRow = data
      portaRowError = error
    }

    if (portaRowError || !portaRow) {
      console.error('[PROXY] Erro ao buscar porta/gaveteiro:', portaRowError)
      throw new Error('Porta não encontrada para abrir')
    }

    const gaveteiro: any = (portaRow as any).gvt_gaveteiros
    const condominio: any = gaveteiro?.gvt_condominios

    const canalEsp32Raw = (portaRow as any)?.canal_esp32
    const canalEsp32 = typeof canalEsp32Raw === 'number' ? canalEsp32Raw : parseInt(String(canalEsp32Raw || ''), 10)
    const portaParaEsp32 = Number.isFinite(canalEsp32) && canalEsp32 > 0 ? canalEsp32 : Number(porta)

    console.log(`[PROXY] Porta solicitada (sistema): ${porta} | Porta enviada ao ESP32 (canal): ${portaParaEsp32}`)

    // Gerar token SHA256 usando a MESMA porta enviada ao ESP32
    const tokenData = `${condominioUid}:${portaUid}:${portaParaEsp32}:AIRE_2025_SUPER_SECRETO`
    const securityToken = crypto.createHash('sha256').update(tokenData).digest('hex')
    
    console.log(`[PROXY] Token gerado para porta/canal ${portaParaEsp32}`)

    const esp32Ip = String(gaveteiro?.esp32_ip || condominio?.esp32_ip || '').trim()
    if (!esp32Ip) {
      return res.status(400).json({
        success: false,
        error: 'ESP32 não configurado. Configure o campo esp32_ip no gaveteiro ou no condomínio.'
      })
    }

    console.log(`[PROXY] IP do banco: ${esp32Ip}`)

    const esp32Url = `http://${esp32Ip}/abrir?condominio_uid=${condominioUid}&porta_uid=${portaUid}&porta=${portaParaEsp32}&token=${securityToken}`
    
    console.log(`[PROXY] URL final: ${esp32Url}`)

    // Enviar requisição para o ESP32
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    let esp32Response: string
    let esp32Status: number | null = null
    let portaAberta = false

    try {
      const response = await fetch(esp32Url, {
        method: 'GET',
        signal: controller.signal
      })

      esp32Status = response.status
      esp32Response = await response.text()
      console.log(`[PROXY] ESP32 respondeu (${response.status}):`, esp32Response)

      // Verificar se a porta foi aberta com sucesso
      portaAberta = response.ok && (
        esp32Response.includes('ABERTA') || 
        esp32Response.includes('aberta') || 
        esp32Response.includes('ok') ||
        esp32Response.includes('success')
      )

    } catch (error: any) {
      console.error('[PROXY] Erro ao comunicar com ESP32:', error)
      esp32Response = error?.name === 'AbortError'
        ? 'Timeout ao comunicar com o ESP32'
        : (error?.message || 'Erro desconhecido')
    } finally {
      clearTimeout(timeoutId)
    }

    return res.status(200).json({
      success: portaAberta,
      message: portaAberta ? `Porta ${porta} aberta com sucesso!` : `Não foi possível abrir a porta ${porta}`,
      esp32Response: esp32Response,
      esp32Status: esp32Status,
      esp32Url: esp32Url,
      canalEsp32: Number.isFinite(canalEsp32) && canalEsp32 > 0 ? canalEsp32 : null,
      portaParaEsp32: portaParaEsp32,
      porta: porta,
      portaUid: portaUid
    })

  } catch (error) {
    console.error('[PROXY] Erro geral:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    })
  }
}
