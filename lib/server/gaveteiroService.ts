import { supabaseServer } from './supabase'
import type { Condominio, Gaveteiro, Porta, MovimentacaoPorta, ResumoPortas, Morador, Bloco, Apartamento } from '../../src/types/gaveteiro'

const TABLES = {
  condominios: 'gvt_condominios',
  gaveteiros: 'gvt_gaveteiros',
  portas: 'gvt_portas',
  autorizacoes_porta: 'gvt_autorizacoes_porta',
  movimentacoes_porta: 'gvt_movimentacoes_porta',
  senhas_provisorias: 'gvt_senhas_provisorias',
  usuarios: 'gvt_usuarios',
  moradores: 'gvt_moradores',
  blocos: 'gvt_blocos',
  apartamentos: 'gvt_apartamentos',
  iot_dispositivos: 'gvt_iot_dispositivos',
  iot_comandos: 'gvt_iot_comandos',
  iot_status: 'gvt_iot_status'
}

export async function listarCondominios(): Promise<Condominio[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.condominios)
    .select('*')
    .eq('ativo', true)
    .order('nome')

  if (error) throw error
  return data || []
}

export async function listarGaveteiros(condominioUid: string): Promise<Gaveteiro[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.gaveteiros)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function obterResumoPortas(gaveteiroUid: string): Promise<ResumoPortas> {
  const { data, error } = await supabaseServer
    .from(TABLES.portas)
    .select('status_atual')
    .eq('gaveteiro_uid', gaveteiroUid)

  if (error) throw error

  const resumo: ResumoPortas = {
    disponivel: 0,
    ocupado: 0,
    aguardando_retirada: 0,
    baixado: 0,
    total: 0
  }

  data?.forEach(porta => {
    resumo.total++
    switch (porta.status_atual) {
      case 'DISPONIVEL':
        resumo.disponivel++
        break
      case 'OCUPADO':
        resumo.ocupado++
        break
      case 'AGUARDANDO_RETIRADA':
        resumo.aguardando_retirada++
        break
      case 'BAIXADO':
        resumo.baixado++
        break
    }
  })

  return resumo
}

export async function listarPortas(gaveteiroUid: string): Promise<Porta[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.portas)
    .select('*')
    .eq('gaveteiro_uid', gaveteiroUid)
    .order('numero_porta', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listarMoradores(condominioUid: string): Promise<Morador[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.moradores)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .order('bloco', { ascending: true, nullsFirst: false })
    .order('apartamento', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listarBlocos(condominioUid: string): Promise<Bloco[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.blocos)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listarApartamentos(condominioUid: string, blocoUid?: string): Promise<Apartamento[]> {
  let query = supabaseServer
    .from(TABLES.apartamentos)
    .select('*, bloco:gvt_blocos(*)')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
  
  if (blocoUid) {
    query = query.eq('bloco_uid', blocoUid)
  }
  
  const { data, error } = await query.order('numero', { ascending: true })

  if (error) throw error
  return data || []
}

export { TABLES }
