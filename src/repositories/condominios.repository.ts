import { supabase } from '../lib/supabaseClient'
import { Condominio } from './portas.repository'

export class CondominiosRepository {
  // Buscar condomínio por UID
  static async buscarPorUid(condominioUid: string): Promise<Condominio | null> {
    const { data, error } = await supabase
      .from('gvt_condominios')
      .select('*')
      .eq('uid', condominioUid)
      .single()

    if (error || !data) {
      console.error('Erro ao buscar condomínio:', error)
      return null
    }

    return data
  }

  // Listar todos os condomínios ativos
  static async listarAtivos(): Promise<Condominio[]> {
    const { data, error } = await supabase
      .from('gvt_condominios')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (error) {
      console.error('Erro ao listar condomínios:', error)
      return []
    }

    return data || []
  }

  // Verificar se condomínio está ativo
  static async verificarAtivo(condominioUid: string): Promise<boolean> {
    const condominio = await this.buscarPorUid(condominioUid)
    return condominio?.ativo || false
  }

  // Atualizar configurações WiFi do condomínio
  static async atualizarWiFi(
    condominioUid: string,
    wifiLogin?: string,
    wifiSenha?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('gvt_condominios')
      .update({
        wifi_login: wifiLogin,
        wifi_senha: wifiSenha,
        updated_at: new Date().toISOString()
      })
      .eq('uid', condominioUid)

    if (error) {
      console.error('Erro ao atualizar WiFi do condomínio:', error)
      return false
    }

    return true
  }
}
