// Cliente API para o frontend
// Todas as chamadas são feitas via API routes server-side
// Isso mantém as chaves do Supabase seguras no servidor

import type { Condominio, Gaveteiro, Porta, MovimentacaoPorta, ResumoPortas, Morador, Bloco, Apartamento } from '../types/gaveteiro'

const API_BASE = '/api'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ============================================
// CONDOMINIOS
// ============================================

export async function listarCondominios(): Promise<Condominio[]> {
  return fetchApi<Condominio[]>('/condominios')
}

// ============================================
// GAVETEIROS
// ============================================

export async function listarGaveteiros(condominioUid: string): Promise<Gaveteiro[]> {
  return fetchApi<Gaveteiro[]>(`/gaveteiros?condominioUid=${condominioUid}`)
}

export async function obterResumoPortas(gaveteiroUid: string): Promise<ResumoPortas> {
  return fetchApi<ResumoPortas>(`/gaveteiros/${gaveteiroUid}/resumo`)
}

// ============================================
// PORTAS
// ============================================

export async function listarPortas(gaveteiroUid: string): Promise<Porta[]> {
  return fetchApi<Porta[]>(`/gaveteiros/${gaveteiroUid}/portas`)
}

export interface Destinatario {
  bloco: string
  apartamento: string
  quantidade?: number
}

export interface SenhaDestinatario {
  bloco: string
  apartamento: string
  senha: string
}

export interface OcuparPortaParams {
  portaUid: string
  condominioUid: string
  destinatarios: Destinatario[]
  usuarioUid?: string
  observacao?: string
}

export interface OcuparPortaResult {
  senhas: SenhaDestinatario[]
  compartilhada: boolean
}

export async function ocuparPorta(params: OcuparPortaParams): Promise<OcuparPortaResult> {
  return fetchApi<OcuparPortaResult>('/portas/ocupar', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

export async function liberarPortaComSenha(
  portaUid: string,
  condominioUid: string,
  senha: string,
  usuarioUid?: string
): Promise<{
  sucesso: boolean
  mensagem: string
  tipoSenha?: 'PROVISORIA' | 'MESTRE'
  bloco?: string
  apartamento?: string
  portaLiberada?: boolean
}> {
  return fetchApi('/portas/liberar', {
    method: 'POST',
    body: JSON.stringify({ portaUid, condominioUid, senha, usuarioUid })
  })
}

export async function cancelarOcupacao(
  portaUid: string,
  condominioUid: string,
  motivo: string,
  usuarioUid?: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  return fetchApi('/portas/cancelar', {
    method: 'POST',
    body: JSON.stringify({ portaUid, condominioUid, motivo, usuarioUid })
  })
}

export async function adicionarDestinatario(
  portaUid: string,
  condominioUid: string,
  destinatario: Destinatario,
  usuarioUid?: string
): Promise<{ sucesso: boolean; mensagem: string; senha?: string }> {
  return fetchApi('/portas/adicionar-destinatario', {
    method: 'POST',
    body: JSON.stringify({ portaUid, condominioUid, destinatario, usuarioUid })
  })
}

export async function buscarSenhasAtivas(portaUid: string): Promise<SenhaDestinatario[]> {
  return fetchApi<SenhaDestinatario[]>(`/portas/senhas-ativas?portaUid=${portaUid}`)
}

export async function darBaixaPorta(
  portaUid: string,
  condominioUid: string,
  usuarioUid?: string
): Promise<void> {
  await fetchApi('/portas/baixar', {
    method: 'POST',
    body: JSON.stringify({ portaUid, condominioUid, usuarioUid })
  })
}

export async function liberarPorta(
  portaUid: string,
  condominioUid: string,
  usuarioUid?: string
): Promise<void> {
  await fetchApi('/portas/liberar-direto', {
    method: 'POST',
    body: JSON.stringify({ portaUid, condominioUid, usuarioUid })
  })
}

// ============================================
// BLOCOS
// ============================================

export async function listarBlocos(condominioUid: string): Promise<Bloco[]> {
  return fetchApi<Bloco[]>(`/blocos?condominioUid=${condominioUid}`)
}

export async function criarBloco(bloco: Omit<Bloco, 'uid' | 'created_at' | 'updated_at'>): Promise<Bloco> {
  return fetchApi<Bloco>('/blocos/criar', {
    method: 'POST',
    body: JSON.stringify(bloco)
  })
}

export async function atualizarBloco(uid: string, bloco: Partial<Bloco>): Promise<Bloco> {
  return fetchApi<Bloco>('/blocos/criar', {
    method: 'PUT',
    body: JSON.stringify({ uid, ...bloco })
  })
}

export async function excluirBloco(uid: string): Promise<void> {
  await fetchApi('/blocos/criar', {
    method: 'DELETE',
    body: JSON.stringify({ uid })
  })
}

// ============================================
// APARTAMENTOS
// ============================================

export async function listarApartamentos(condominioUid: string, blocoUid?: string): Promise<Apartamento[]> {
  let url = `/apartamentos?condominioUid=${condominioUid}`
  if (blocoUid) url += `&blocoUid=${blocoUid}`
  return fetchApi<Apartamento[]>(url)
}

export async function criarApartamento(apartamento: Omit<Apartamento, 'uid' | 'created_at' | 'updated_at' | 'bloco'>): Promise<Apartamento> {
  return fetchApi<Apartamento>('/apartamentos/criar', {
    method: 'POST',
    body: JSON.stringify(apartamento)
  })
}

export async function atualizarApartamento(uid: string, apartamento: Partial<Apartamento>): Promise<Apartamento> {
  return fetchApi<Apartamento>('/apartamentos/criar', {
    method: 'PUT',
    body: JSON.stringify({ uid, ...apartamento })
  })
}

export async function excluirApartamento(uid: string): Promise<void> {
  await fetchApi('/apartamentos/criar', {
    method: 'DELETE',
    body: JSON.stringify({ uid })
  })
}

// ============================================
// MORADORES
// ============================================

export async function listarMoradores(condominioUid: string): Promise<Morador[]> {
  return fetchApi<Morador[]>(`/moradores?condominioUid=${condominioUid}`)
}

export async function criarMorador(morador: Omit<Morador, 'uid' | 'created_at' | 'updated_at'>): Promise<Morador> {
  return fetchApi<Morador>('/moradores/criar', {
    method: 'POST',
    body: JSON.stringify(morador)
  })
}

export async function atualizarMorador(uid: string, morador: Partial<Morador>): Promise<Morador> {
  return fetchApi<Morador>('/moradores/criar', {
    method: 'PUT',
    body: JSON.stringify({ uid, ...morador })
  })
}

export async function excluirMorador(uid: string): Promise<void> {
  await fetchApi('/moradores/criar', {
    method: 'DELETE',
    body: JSON.stringify({ uid })
  })
}

// ============================================
// MOVIMENTAÇÕES
// ============================================

export async function listarMovimentacoes(condominioUid: string, limit?: number): Promise<any[]> {
  let url = `/movimentacoes?condominioUid=${condominioUid}`
  if (limit) url += `&limit=${limit}`
  return fetchApi<any[]>(url)
}

// ============================================
// VALIDAÇÃO DE SENHA (para AbrirPortaPublico)
// ============================================

export async function validarSenha(senha: string, condominioUid?: string): Promise<{
  tipo: 'PROVISORIA' | 'MESTRE' | 'INVALIDA'
  senhaUid?: string
  portaUid?: string
  bloco?: string
  apartamento?: string
  porta?: any
  gaveteiro?: any
  condominio?: any
}> {
  return fetchApi('/portas/validar-senha', {
    method: 'POST',
    body: JSON.stringify({ senha, condominioUid })
  })
}

// ============================================
// IOT COMANDOS
// ============================================

export type IotCommandStatus = 'PENDING' | 'ACK' | 'DONE' | 'ERROR' | 'EXPIRED'

export interface IotCommandRow {
  uid: string
  device_id: string
  tipo: string
  payload: any
  status: IotCommandStatus
  erro?: string | null
  created_at: string
  ack_at?: string | null
  done_at?: string | null
}

export async function solicitarAberturaPortaIot(params: {
  deviceId: string
  portaNumero: number
  pulseMs?: number
  token?: string
}): Promise<IotCommandRow> {
  return fetchApi<IotCommandRow>('/iot/abrir', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

export async function consultarComandoIot(comandoUid: string): Promise<IotCommandRow | null> {
  try {
    return await fetchApi<IotCommandRow>(`/iot/status?comandoUid=${comandoUid}`)
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function aguardarConclusaoComandoIot(
  comandoUid: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<IotCommandRow> {
  const timeoutMs = opts?.timeoutMs ?? 15000
  const intervalMs = opts?.intervalMs ?? 500
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const comando = await consultarComandoIot(comandoUid)
    if (comando && (comando.status === 'DONE' || comando.status === 'ERROR' || comando.status === 'EXPIRED')) {
      return comando
    }
    await sleep(intervalMs)
  }

  const comando = await consultarComandoIot(comandoUid)
  if (!comando) throw new Error('Comando não encontrado')
  return comando
}

// ============================================
// ESP32 DIRETO (não passa pelo Supabase)
// ============================================

export interface Esp32OpenParams {
  baseUrl: string
  token: string
  lockId?: number
  numeroPorta?: number
  timeoutMs?: number
}

export async function abrirPortaEsp32(params: Esp32OpenParams): Promise<{ ok: boolean; message?: string }> {
  const { baseUrl, token, numeroPorta = 1, timeoutMs = 10000 } = params

  if (!baseUrl || !token) {
    throw new Error('Configuração do ESP32 incompleta (baseUrl/token)')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/abrir?porta=${numeroPorta}`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    const text = await res.text()
    console.log('[ESP32] Resposta ABRIR:', res.status, text)
    
    const isSuccess = res.ok && (text.includes('ABERTA') || text.includes('aberta') || text.includes('ok'))
    return { ok: isSuccess, message: text }
  } catch (err: any) {
    console.error('[ESP32] Erro ao abrir:', err.message)
    if (err.name === 'AbortError') {
      throw new Error('Timeout ao conectar com ESP32')
    }
    throw err
  } finally {
    clearTimeout(t)
  }
}

export async function fecharPortaEsp32(params: Esp32OpenParams): Promise<{ ok: boolean; message?: string }> {
  const { baseUrl, token, numeroPorta = 1, timeoutMs = 10000 } = params

  if (!baseUrl || !token) {
    throw new Error('Configuração do ESP32 incompleta (baseUrl/token)')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/fechar?porta=${numeroPorta}`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    const text = await res.text()
    console.log('[ESP32] Resposta FECHAR:', res.status, text)
    
    const isSuccess = res.ok && (text.includes('FECHADA') || text.includes('fechada') || text.includes('ok'))
    return { ok: isSuccess, message: text }
  } catch (err: any) {
    console.error('[ESP32] Erro ao fechar:', err.message)
    if (err.name === 'AbortError') {
      throw new Error('Timeout ao conectar com ESP32')
    }
    throw err
  } finally {
    clearTimeout(t)
  }
}
