import { supabase } from '../lib/supabaseClient'

export interface Gaveteiro {
  uid: string
  condominio_uid: string
  nome: string
  codigo_hardware: string
  descricao?: string
  ativo: boolean
  created_at: string
  esp32_ip?: string
  esp32_token: string
}

export class GaveteirosRepository {
  // Buscar gaveteiro por UID
  static async buscarPorUid(gaveteiroUid: string): Promise<Gaveteiro | null> {
    const { data, error } = await supabase
      .from('gvt_gaveteiros')
      .select('*')
      .eq('uid', gaveteiroUid)
      .single()

    if (error || !data) {
      console.error('Erro ao buscar gaveteiro:', error)
      return null
    }

    return data
  }

  // Buscar gaveteiro por código de hardware
  static async buscarPorCodigoHardware(codigoHardware: string): Promise<Gaveteiro | null> {
    const { data, error } = await supabase
      .from('gvt_gaveteiros')
      .select('*')
      .eq('codigo_hardware', codigoHardware)
      .single()

    if (error || !data) {
      console.error('Erro ao buscar gaveteiro por código:', error)
      return null
    }

    return data
  }

  // Listar gaveteiros por condomínio
  static async listarPorCondominio(condominioUid: string): Promise<Gaveteiro[]> {
    const { data, error } = await supabase
      .from('gvt_gaveteiros')
      .select('*')
      .eq('condominio_uid', condominioUid)
      .eq('ativo', true)
      .order('nome')

    if (error) {
      console.error('Erro ao listar gaveteiros do condomínio:', error)
      return []
    }

    return data || []
  }

  // Verificar se gaveteiro está ativo
  static async verificarAtivo(gaveteiroUid: string): Promise<boolean> {
    const gaveteiro = await this.buscarPorUid(gaveteiroUid)
    return gaveteiro?.ativo || false
  }

  // Atualizar IP do ESP32
  static async atualizarIP(gaveteiroUid: string, esp32IP: string): Promise<boolean> {
    const { error } = await supabase
      .from('gvt_gaveteiros')
      .update({
        esp32_ip: esp32IP,
        updated_at: new Date().toISOString()
      })
      .eq('uid', gaveteiroUid)

    if (error) {
      console.error('Erro ao atualizar IP do gaveteiro:', error)
      return false
    }

    return true
  }

  // Atualizar token do ESP32
  static async atualizarToken(gaveteiroUid: string, esp32Token: string): Promise<boolean> {
    const { error } = await supabase
      .from('gvt_gaveteiros')
      .update({
        esp32_token: esp32Token,
        updated_at: new Date().toISOString()
      })
      .eq('uid', gaveteiroUid)

    if (error) {
      console.error('Erro ao atualizar token do gaveteiro:', error)
      return false
    }

    return true
  }

  // Listar todos os gaveteiros ativos
  static async listarAtivos(): Promise<Gaveteiro[]> {
    const { data, error } = await supabase
      .from('gvt_gaveteiros')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (error) {
      console.error('Erro ao listar gaveteiros ativos:', error)
      return []
    }

    return data || []
  }
}
