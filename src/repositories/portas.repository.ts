import { supabase } from '../lib/supabaseClient'

export interface Porta {
  uid: string
  condominio_uid: string
  gaveteiro_uid: string
  numero_porta: number
  status_atual: 'DISPONIVEL' | 'OCUPADO' | 'MANUTENCAO'
  ocupado_em?: string
  finalizado_em?: string
  ultimo_evento_em: string
  cliente_uid?: string
  ativo: boolean
  tamanho?: 'P' | 'M' | 'G' | 'GG'
  bloco_atual?: string
  apartamento_atual?: string
  compartilhada?: boolean
  fechadura_status: 'aberta' | 'fechada'
  sensor_status: 'desconhecido' | 'aberto' | 'fechado'
  status_fisico_atualizado_em?: string
  sensor_ima_status: 'desconhecido' | 'aberto' | 'fechado'
  sensor_ima_atualizado_em?: string
}

export interface Condominio {
  uid: string
  nome: string
  ativo: boolean
  wifi_login?: string
  wifi_senha?: string
}

export class PortasRepository {
  // Buscar porta por UID (sempre filtrando por condomínio)
  static async buscarPorUid(portaUid: string, condominioUid: string): Promise<Porta | null> {
    const { data, error } = await supabase
      .from('gvt_portas')
      .select('*')
      .eq('uid', portaUid)
      .eq('condominio_uid', condominioUid)
      .eq('ativo', true)
      .single()

    if (error || !data) {
      console.error('Erro ao buscar porta:', error)
      return null
    }

    return data
  }

  // Buscar portas por condomínio
  static async buscarPorCondominio(condominioUid: string): Promise<Porta[]> {
    const { data, error } = await supabase
      .from('gvt_portas')
      .select('*')
      .eq('condominio_uid', condominioUid)
      .eq('ativo', true)
      .order('numero_porta')

    if (error) {
      console.error('Erro ao buscar portas do condomínio:', error)
      return []
    }

    return data || []
  }

  // Buscar portas por gaveteiro (sempre filtrando por condomínio)
  static async buscarPorGaveteiro(gaveteiroUid: string, condominioUid: string): Promise<Porta[]> {
    const { data, error } = await supabase
      .from('gvt_portas')
      .select('*')
      .eq('gaveteiro_uid', gaveteiroUid)
      .eq('condominio_uid', condominioUid)
      .eq('ativo', true)
      .order('numero_porta')

    if (error) {
      console.error('Erro ao buscar portas do gaveteiro:', error)
      return []
    }

    return data || []
  }

  // Atualizar status da porta (sempre filtrando por condomínio)
  static async atualizarStatus(
    portaUid: string,
    condominioUid: string,
    atualizacoes: Partial<Pick<Porta, 'fechadura_status' | 'sensor_status' | 'sensor_ima_status' | 'status_atual' | 'ocupado_em' | 'finalizado_em' | 'ultimo_evento_em' | 'cliente_uid' | 'bloco_atual' | 'apartamento_atual'>>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('gvt_portas')
      .update({
        ...atualizacoes,
        ultimo_evento_em: atualizacoes.ultimo_evento_em || new Date().toISOString()
      })
      .eq('uid', portaUid)
      .eq('condominio_uid', condominioUid)

    if (error) {
      console.error('Erro ao atualizar status da porta:', error)
      return false
    }

    return true
  }

  // Verificar se porta está disponível para abertura
  static async verificarDisponibilidade(portaUid: string, condominioUid: string): Promise<boolean> {
    const porta = await this.buscarPorUid(portaUid, condominioUid)
    
    if (!porta) {
      return false
    }

    return porta.status_atual === 'DISPONIVEL' && porta.fechadura_status === 'fechada'
  }

  // Registrar abertura de porta
  static async registrarAbertura(portaUid: string, condominioUid: string, clienteUid?: string, bloco?: string, apartamento?: string): Promise<boolean> {
    return this.atualizarStatus(portaUid, condominioUid, {
      fechadura_status: 'aberta',
      status_atual: 'OCUPADO',
      ocupado_em: new Date().toISOString(),
      cliente_uid: clienteUid,
      bloco_atual: bloco,
      apartamento_atual: apartamento
    })
  }

  // Registrar fechamento de porta
  static async registrarFechamento(portaUid: string, condominioUid: string): Promise<boolean> {
    return this.atualizarStatus(portaUid, condominioUid, {
      fechadura_status: 'fechada',
      status_atual: 'DISPONIVEL',
      finalizado_em: new Date().toISOString(),
      cliente_uid: undefined,
      bloco_atual: undefined,
      apartamento_atual: undefined
    })
  }

  // Buscar portas por bloco e apartamento
  static async buscarPorBlocoApto(condominioUid: string, bloco: string, apartamento: string): Promise<Porta[]> {
    const { data, error } = await supabase
      .from('gvt_portas')
      .select('*')
      .eq('condominio_uid', condominioUid)
      .eq('bloco_atual', bloco)
      .eq('apartamento_atual', apartamento)
      .eq('ativo', true)
      .order('numero_porta')

    if (error) {
      console.error('Erro ao buscar portas do bloco/apto:', error)
      return []
    }

    return data || []
  }

  // Atualizar status físico do sensor
  static async atualizarStatusSensor(
    portaUid: string,
    condominioUid: string,
    sensorStatus: 'desconhecido' | 'aberto' | 'fechado',
    sensorImaStatus: 'desconhecido' | 'aberto' | 'fechado'
  ): Promise<boolean> {
    return this.atualizarStatus(portaUid, condominioUid, {
      sensor_status: sensorStatus,
      sensor_ima_status: sensorImaStatus,
      ultimo_evento_em: new Date().toISOString()
    })
  }
}
