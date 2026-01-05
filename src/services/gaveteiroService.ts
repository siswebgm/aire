import { supabase } from '../lib/supabaseClient'
import type { Condominio, Gaveteiro, Porta, MovimentacaoPorta, ResumoPortas, Morador, Bloco, Apartamento } from '../types/gaveteiro'

// ============================================
// NOMES DAS TABELAS (schema cobrancas com prefixo gvt_)
// ============================================
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

// ============================================
// CONDOMINIOS
// ============================================

export async function listarCondominios(): Promise<Condominio[]> {
  const { data, error } = await supabase
    .from(TABLES.condominios)
    .select('*')
    .eq('ativo', true)
    .order('nome')

  if (error) {
    console.error('Erro ao listar condominios:', error)
    throw error
  }

  return data || []
}

// ============================================
// GAVETEIROS
// ============================================

export async function listarGaveteiros(condominioUid: string): Promise<Gaveteiro[]> {
  const { data, error } = await supabase
    .from(TABLES.gaveteiros)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao listar gaveteiros:', error)
    throw error
  }

  return data || []
}

export async function obterResumoPortas(gaveteiroUid: string): Promise<ResumoPortas> {
  const { data, error } = await supabase
    .from(TABLES.portas)
    .select('status_atual')
    .eq('gaveteiro_uid', gaveteiroUid)

  if (error) {
    console.error('Erro ao obter resumo portas:', error)
    throw error
  }

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

// ============================================
// PORTAS
// ============================================

export async function listarPortas(gaveteiroUid: string): Promise<Porta[]> {
  const { data, error } = await supabase
    .from(TABLES.portas)
    .select('*')
    .eq('gaveteiro_uid', gaveteiroUid)
    .order('numero_porta', { ascending: true })

  if (error) {
    console.error('Erro ao listar portas:', error)
    throw error
  }

  return data || []
}

export async function listarTodasPortas(condominioUid: string): Promise<Porta[]> {
  const { data, error } = await supabase
    .from(TABLES.portas)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .order('numero_porta', { ascending: true })

  if (error) {
    console.error('Erro ao listar todas as portas:', error)
    throw error
  }
  
  return data || []
}

// Gera senha provisória de 6 dígitos
function gerarSenhaAleatoria(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Verifica se a senha já existe como ATIVA no condomínio
async function senhaExiste(condominioUid: string, senha: string): Promise<boolean> {
  const { data } = await supabase
    .from(TABLES.senhas_provisorias)
    .select('uid')
    .eq('condominio_uid', condominioUid)
    .eq('senha', senha)
    .eq('status', 'ATIVA')
    .limit(1)

  return (data?.length || 0) > 0
}

// Gera senha única (verifica se não existe no condomínio)
export async function gerarSenhaUnica(condominioUid: string): Promise<string> {
  let tentativas = 0
  const maxTentativas = 100

  while (tentativas < maxTentativas) {
    const senha = gerarSenhaAleatoria()
    const existe = await senhaExiste(condominioUid, senha)
    
    if (!existe) {
      return senha
    }
    
    tentativas++
  }

  // Fallback: gera senha de 8 dígitos se muitas tentativas
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

export async function atualizarStatusPorta(
  portaUid: string,
  novoStatus: string,
  usuarioUid?: string,
  bloco?: string,
  apartamento?: string,
  compartilhada?: boolean
): Promise<void> {
  const agora = new Date().toISOString()

  // Atualizar porta
  const updateData: Partial<Porta> = {
    status_atual: novoStatus as Porta['status_atual'],
    ultimo_evento_em: agora
  }

  if (novoStatus === 'OCUPADO') {
    updateData.ocupado_em = agora
    updateData.finalizado_em = undefined
    updateData.bloco_atual = bloco
    updateData.apartamento_atual = apartamento
    updateData.compartilhada = compartilhada || false
  } else if (novoStatus === 'BAIXADO' || novoStatus === 'DISPONIVEL') {
    updateData.finalizado_em = agora
    // Limpar dados do ocupante ao liberar
    updateData.bloco_atual = undefined
    updateData.apartamento_atual = undefined
    updateData.compartilhada = false
  }

  const { error: updateError } = await supabase
    .from(TABLES.portas)
    .update(updateData)
    .eq('uid', portaUid)

  if (updateError) {
    console.error('Erro ao atualizar porta:', updateError)
    throw updateError
  }
}

// ============================================
// SENHAS PROVISÓRIAS
// ============================================

export interface SenhaDestinatario {
  bloco: string
  apartamento: string
  senha: string
}

// Criar senhas provisórias ÚNICAS para cada destinatário
export async function criarSenhasProvisórias(
  portaUid: string,
  condominioUid: string,
  destinatarios: Destinatario[]
): Promise<SenhaDestinatario[]> {
  const senhas: SenhaDestinatario[] = []
  const senhasUsadas = new Set<string>() // Evita duplicatas na mesma operação

  for (const dest of destinatarios) {
    let senha: string
    
    // Gera senha única que não existe no banco E não está sendo usada agora
    do {
      senha = await gerarSenhaUnica(condominioUid)
    } while (senhasUsadas.has(senha))
    
    senhasUsadas.add(senha)
    
    senhas.push({
      bloco: dest.bloco,
      apartamento: dest.apartamento,
      senha
    })
  }

  // Inserir todas as senhas no banco
  const { error } = await supabase
    .from(TABLES.senhas_provisorias)
    .insert(
      senhas.map(s => ({
        porta_uid: portaUid,
        condominio_uid: condominioUid,
        bloco: s.bloco,
        apartamento: s.apartamento,
        senha: s.senha,
        status: 'ATIVA'
      }))
    )

  if (error) {
    console.error('Erro ao criar senhas provisórias:', error)
    throw error
  }

  return senhas
}

// Buscar senhas ativas de uma porta
export async function buscarSenhasAtivas(portaUid: string): Promise<SenhaDestinatario[]> {
  const { data, error } = await supabase
    .from(TABLES.senhas_provisorias)
    .select('*')
    .eq('porta_uid', portaUid)
    .eq('status', 'ATIVA')

  if (error) {
    console.error('Erro ao buscar senhas ativas:', error)
    throw error
  }

  return (data || []).map(s => ({
    bloco: s.bloco,
    apartamento: s.apartamento,
    senha: s.senha
  }))
}

// Cancelar todas as senhas de uma porta
export async function cancelarSenhasPorta(portaUid: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.senhas_provisorias)
    .update({ status: 'CANCELADA' })
    .eq('porta_uid', portaUid)
    .eq('status', 'ATIVA')

  if (error) {
    console.error('Erro ao cancelar senhas:', error)
    throw error
  }
}

// ============================================
// MOVIMENTACOES
// ============================================

export async function registrarMovimentacao(
  portaUid: string,
  condominioUid: string,
  acao: string,
  statusResultante: string,
  usuarioUid?: string,
  origem: string = 'WEB',
  observacao?: string,
  bloco?: string,
  apartamento?: string,
  compartilhada?: boolean,
  destinatarios?: Destinatario[]
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.movimentacoes_porta)
    .insert({
      porta_uid: portaUid,
      condominio_uid: condominioUid,
      usuario_uid: usuarioUid,
      acao,
      status_resultante: statusResultante,
      origem,
      observacao,
      bloco,
      apartamento,
      compartilhada: compartilhada || false,
      destinatarios: destinatarios || null
    })

  if (error) {
    console.error('Erro ao registrar movimentacao:', error)
    throw error
  }
}

export async function listarMovimentacoes(portaUid: string, limite: number = 50): Promise<MovimentacaoPorta[]> {
  const { data, error } = await supabase
    .from(TABLES.movimentacoes_porta)
    .select('*')
    .eq('porta_uid', portaUid)
    .order('timestamp', { ascending: false })
    .limit(limite)

  if (error) {
    console.error('Erro ao listar movimentacoes:', error)
    throw error
  }

  return data || []
}

// ============================================
// AÇÕES PRINCIPAIS (OCUPAR / BAIXAR / LIBERAR)
// ============================================

// Interface para destinatários (bloco + apartamento)
export interface Destinatario {
  bloco: string
  apartamento: string
  quantidade?: number
}

export interface OcuparPortaParams {
  portaUid: string
  condominioUid: string
  destinatarios: Destinatario[]  // Um ou mais destinatários
  usuarioUid?: string
  observacao?: string
}

export interface OcuparPortaResult {
  senhas: SenhaDestinatario[]  // Cada destinatário tem sua senha
  compartilhada: boolean
}

export async function ocuparPorta(params: OcuparPortaParams): Promise<OcuparPortaResult> {
  const { portaUid, condominioUid, destinatarios, usuarioUid, observacao } = params

  // Validação: pelo menos um destinatário
  if (!destinatarios || destinatarios.length === 0) {
    throw new Error('É necessário informar pelo menos um destinatário (bloco e apartamento)')
  }

  // Validação: cada destinatário precisa ter bloco e apartamento
  // Quantidade é opcional (default=1) e será persistida em JSON
  const destinatariosValidos = destinatarios
    .map(dest => ({
      bloco: dest.bloco.trim(),
      apartamento: dest.apartamento.trim(),
      quantidade: Math.max(1, Number(dest.quantidade ?? 1) || 1)
    }))
    .filter(d => d.bloco && d.apartamento)

  if (destinatariosValidos.length === 0) {
    throw new Error('Bloco e Apartamento são obrigatórios')
  }

  const compartilhada = destinatariosValidos.length > 1

  // Concatenar blocos e apartamentos para exibição
  const blocos = destinatariosValidos.map(d => d.bloco).join(', ')
  const apartamentos = destinatariosValidos
    .map(d => (d.quantidade && d.quantidade > 1 ? `${d.apartamento} x${d.quantidade}` : d.apartamento))
    .join(', ')

  // 1. Atualizar status da porta para OCUPADO
  await atualizarStatusPorta(
    portaUid, 
    'OCUPADO', 
    usuarioUid, 
    blocos, 
    apartamentos, 
    compartilhada
  )

  // 2. Criar senhas provisórias para CADA encomenda (expandindo por quantidade)
  const destinatariosParaSenhas: Destinatario[] = destinatariosValidos.flatMap(d =>
    Array.from({ length: d.quantidade || 1 }).map(() => ({ bloco: d.bloco, apartamento: d.apartamento }))
  )
  const senhas = await criarSenhasProvisórias(portaUid, condominioUid, destinatariosParaSenhas)

  // 3. Registrar movimentação (com destinatarios em JSON, incluindo quantidade)
  await registrarMovimentacao(
    portaUid,
    condominioUid,
    'OCUPAR',
    'OCUPADO',
    usuarioUid,
    'WEB',
    observacao,
    blocos,
    apartamentos,
    compartilhada,
    destinatariosValidos // JSON com array de {bloco, apartamento, quantidade}
  )

  // 4. Log
  console.log(`[ESP32] Porta ${portaUid} ocupada por ${blocos} - Apto ${apartamentos}${compartilhada ? ' (COMPARTILHADA)' : ''}`)
  senhas.forEach(s => {
    console.log(`[SENHA] ${s.bloco} - Apto ${s.apartamento}: ${s.senha}`)
  })

  return {
    senhas,
    compartilhada
  }
}

// Buscar senha mestre do condomínio
export async function buscarSenhaMestre(condominioUid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.condominios)
    .select('senha_mestre')
    .eq('uid', condominioUid)
    .single()

  if (error) {
    console.error('Erro ao buscar senha mestre:', error)
    return null
  }

  return data?.senha_mestre || null
}

// Validar senha provisória (verifica se está ATIVA)
export async function validarSenhaProvisoria(
  portaUid: string,
  senha: string
): Promise<{ valida: boolean; senhaUid?: string; bloco?: string; apartamento?: string }> {
  const { data, error } = await supabase
    .from(TABLES.senhas_provisorias)
    .select('*')
    .eq('porta_uid', portaUid)
    .eq('senha', senha)
    .eq('status', 'ATIVA')
    .single()

  if (error || !data) {
    return { valida: false }
  }

  return {
    valida: true,
    senhaUid: data.uid,
    bloco: data.bloco,
    apartamento: data.apartamento
  }
}

// Marcar senha como usada
export async function marcarSenhaUsada(senhaUid: string, usuarioUid?: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.senhas_provisorias)
    .update({
      status: 'USADA',
      usada_em: new Date().toISOString(),
      usada_por: usuarioUid
    })
    .eq('uid', senhaUid)

  if (error) {
    console.error('Erro ao marcar senha como usada:', error)
    throw error
  }
}

// Verificar se todas as senhas foram usadas
export async function todasSenhasUsadas(portaUid: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLES.senhas_provisorias)
    .select('status')
    .eq('porta_uid', portaUid)

  if (error || !data) return false

  // Retorna true se não tem nenhuma senha ATIVA
  return !data.some(s => s.status === 'ATIVA')
}

// Liberar porta com validação de senha
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
  // 1. Verificar senha mestre primeiro
  const senhaMestre = await buscarSenhaMestre(condominioUid)
  
  if (senhaMestre && senhaMestre === senha) {
    // Senha mestre: cancela todas as senhas e libera a porta
    await cancelarSenhasPorta(portaUid)
    await atualizarStatusPorta(portaUid, 'DISPONIVEL', usuarioUid)
    
    await registrarMovimentacao(
      portaUid,
      condominioUid,
      'LIBERAR',
      'DISPONIVEL',
      usuarioUid,
      'WEB',
      'Liberado com senha MESTRE'
    )

    console.log(`[ESP32] Porta ${portaUid} liberada com senha MESTRE`)
    
    return { 
      sucesso: true, 
      mensagem: 'Porta liberada com senha mestre',
      tipoSenha: 'MESTRE',
      portaLiberada: true
    }
  }

  // 2. Verificar senha provisória
  const resultadoSenha = await validarSenhaProvisoria(portaUid, senha)
  
  if (!resultadoSenha.valida) {
    return { sucesso: false, mensagem: 'Senha inválida ou já utilizada' }
  }

  // 3. Marcar esta senha específica como usada
  await marcarSenhaUsada(resultadoSenha.senhaUid!, usuarioUid)

  // 4. Registrar movimentação de retirada
  await registrarMovimentacao(
    portaUid,
    condominioUid,
    'RETIRADA',
    'OCUPADO', // Ainda ocupado até todas as senhas serem usadas
    usuarioUid,
    'WEB',
    `Retirada: ${resultadoSenha.bloco} - Apto ${resultadoSenha.apartamento}`
  )

  // 5. Verificar se todas as senhas foram usadas
  const todasUsadas = await todasSenhasUsadas(portaUid)
  
  if (todasUsadas) {
    // Liberar a porta automaticamente
    await atualizarStatusPorta(portaUid, 'DISPONIVEL', usuarioUid)
    
    await registrarMovimentacao(
      portaUid,
      condominioUid,
      'LIBERAR',
      'DISPONIVEL',
      usuarioUid,
      'WEB',
      'Todas as retiradas concluídas'
    )

    console.log(`[ESP32] Porta ${portaUid} liberada - todas as senhas usadas`)

    return { 
      sucesso: true, 
      mensagem: `Retirada confirmada (${resultadoSenha.bloco} - Apto ${resultadoSenha.apartamento}). Porta liberada!`,
      tipoSenha: 'PROVISORIA',
      bloco: resultadoSenha.bloco,
      apartamento: resultadoSenha.apartamento,
      portaLiberada: true
    }
  }

  // Porta ainda tem senhas ativas (outros destinatários)
  console.log(`[ESP32] Retirada registrada para ${resultadoSenha.bloco} - Apto ${resultadoSenha.apartamento}`)
  
  return { 
    sucesso: true, 
    mensagem: `Retirada confirmada (${resultadoSenha.bloco} - Apto ${resultadoSenha.apartamento}). Aguardando outros destinatários.`,
    tipoSenha: 'PROVISORIA',
    bloco: resultadoSenha.bloco,
    apartamento: resultadoSenha.apartamento,
    portaLiberada: false
  }
}

// Cancelar ocupação (sem senha - para erros de registro)
export async function cancelarOcupacao(
  portaUid: string,
  condominioUid: string,
  motivo: string,
  usuarioUid?: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    // 1. Cancelar todas as senhas provisórias ativas
    await cancelarSenhasPorta(portaUid)
    
    // 2. Atualizar status da porta para DISPONÍVEL
    await atualizarStatusPorta(portaUid, 'DISPONIVEL', usuarioUid)
    
    // 3. Registrar movimentação de cancelamento
    await registrarMovimentacao(
      portaUid,
      condominioUid,
      'CANCELAR',
      'DISPONIVEL',
      usuarioUid,
      'WEB',
      `Ocupação cancelada: ${motivo}`
    )

    console.log(`[CANCELAMENTO] Porta ${portaUid} - Ocupação cancelada: ${motivo}`)
    
    return { 
      sucesso: true, 
      mensagem: 'Ocupação cancelada com sucesso. A porta está disponível novamente.' 
    }
  } catch (error) {
    console.error('Erro ao cancelar ocupação:', error)
    return { 
      sucesso: false, 
      mensagem: 'Erro ao cancelar ocupação. Tente novamente.' 
    }
  }
}

// Função legada para compatibilidade
export async function abrirPorta(
  portaUid: string,
  condominioUid: string,
  usuarioUid?: string,
  bloco?: string,
  apartamento?: string
): Promise<OcuparPortaResult> {
  if (!bloco || !apartamento) {
    throw new Error('Bloco e Apartamento são obrigatórios para ocupar uma porta')
  }
  
  return ocuparPorta({
    portaUid,
    condominioUid,
    destinatarios: [{ bloco, apartamento }],
    usuarioUid
  })
}

export async function darBaixaPorta(
  portaUid: string,
  condominioUid: string,
  usuarioUid?: string
): Promise<void> {
  // 1. Atualizar status da porta para BAIXADO
  await atualizarStatusPorta(portaUid, 'BAIXADO', usuarioUid)

  // 2. Registrar movimentação
  await registrarMovimentacao(
    portaUid,
    condominioUid,
    'BAIXAR',
    'BAIXADO',
    usuarioUid,
    'WEB'
  )

  console.log(`[ESP32] Baixa registrada para porta ${portaUid}`)
}

export async function liberarPorta(
  portaUid: string,
  condominioUid: string,
  usuarioUid?: string
): Promise<void> {
  // 1. Atualizar status da porta para DISPONIVEL (limpa bloco/apto)
  await atualizarStatusPorta(portaUid, 'DISPONIVEL', usuarioUid)

  // 2. Registrar movimentação
  await registrarMovimentacao(
    portaUid,
    condominioUid,
    'LIBERAR',
    'DISPONIVEL',
    usuarioUid,
    'WEB'
  )

  console.log(`[ESP32] Porta ${portaUid} liberada`)
}

// ============================================
// MORADORES
// ============================================

export async function listarMoradores(condominioUid: string): Promise<Morador[]> {
  const { data, error } = await supabase
    .from(TABLES.moradores)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .or('deletado.is.null,deletado.eq.false')
    .order('bloco', { ascending: true, nullsFirst: false })
    .order('apartamento', { ascending: true })

  if (error) {
    console.error('Erro ao listar moradores:', error)
    throw error
  }

  return data || []
}

export async function criarMorador(morador: Omit<Morador, 'uid' | 'created_at' | 'updated_at'>): Promise<Morador> {
  const { data, error } = await supabase
    .from(TABLES.moradores)
    .insert(morador)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar morador:', error)
    throw error
  }

  return data
}

export async function atualizarMorador(uid: string, morador: Partial<Morador>): Promise<Morador> {
  const { data, error } = await supabase
    .from(TABLES.moradores)
    .update(morador)
    .eq('uid', uid)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar morador:', error)
    throw error
  }

  return data
}

export async function excluirMorador(uid: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.moradores)
    .update({ ativo: false })
    .eq('uid', uid)

  if (error) {
    console.error('Erro ao excluir morador:', error)
    throw error
  }
}

// ============================================
// BLOCOS
// ============================================

export async function listarBlocos(condominioUid: string): Promise<Bloco[]> {
  const { data, error } = await supabase
    .from(TABLES.blocos)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) {
    console.error('Erro ao listar blocos:', error)
    throw error
  }

  return data || []
}

export async function criarBloco(bloco: Omit<Bloco, 'uid' | 'created_at' | 'updated_at'>): Promise<Bloco> {
  const { data, error } = await supabase
    .from(TABLES.blocos)
    .insert(bloco)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar bloco:', error)
    throw error
  }

  return data
}

export async function atualizarBloco(uid: string, bloco: Partial<Bloco>): Promise<Bloco> {
  const { data, error } = await supabase
    .from(TABLES.blocos)
    .update(bloco)
    .eq('uid', uid)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar bloco:', error)
    throw error
  }

  return data
}

export async function excluirBloco(uid: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.blocos)
    .update({ ativo: false })
    .eq('uid', uid)

  if (error) {
    console.error('Erro ao excluir bloco:', error)
    throw error
  }
}

// ============================================
// APARTAMENTOS
// ============================================

export async function listarApartamentos(condominioUid: string, blocoUid?: string): Promise<Apartamento[]> {
  let query = supabase
    .from(TABLES.apartamentos)
    .select('*, bloco:gvt_blocos(*)')
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
  
  if (blocoUid) {
    query = query.eq('bloco_uid', blocoUid)
  }
  
  const { data, error } = await query.order('numero', { ascending: true })

  if (error) {
    console.error('Erro ao listar apartamentos:', error)
    throw error
  }

  return data || []
}

export async function criarApartamento(apartamento: Omit<Apartamento, 'uid' | 'created_at' | 'updated_at' | 'bloco'>): Promise<Apartamento> {
  const { data, error } = await supabase
    .from(TABLES.apartamentos)
    .insert(apartamento)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar apartamento:', error)
    throw error
  }

  return data
}

export async function atualizarApartamento(uid: string, apartamento: Partial<Apartamento>): Promise<Apartamento> {
  const { bloco, ...rest } = apartamento // Remove o campo bloco do update
  const { data, error } = await supabase
    .from(TABLES.apartamentos)
    .update(rest)
    .eq('uid', uid)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar apartamento:', error)
    throw error
  }

  return data
}

export async function excluirApartamento(uid: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.apartamentos)
    .update({ ativo: false })
    .eq('uid', uid)

  if (error) {
    console.error('Erro ao excluir apartamento:', error)
    throw error
  }
}

// ============================================
// BUSCA POR BLOCO/APARTAMENTO
// ============================================

export interface MovimentacaoBlocoApartamento {
  uid: string
  porta_uid: string
  numero_porta: number
  gaveteiro_nome: string
  gaveteiro_codigo: string
  bloco: string
  apartamento: string
  compartilhada: boolean
  acao: string
  status_resultante: string
  timestamp: string
  observacao?: string
}

export async function buscarPorBlocoApartamento(
  condominioUid: string,
  bloco?: string,
  apartamento?: string
): Promise<MovimentacaoBlocoApartamento[]> {
  let query = supabase
    .from(TABLES.movimentacoes_porta)
    .select(`
      uid,
      porta_uid,
      bloco,
      apartamento,
      compartilhada,
      acao,
      status_resultante,
      timestamp,
      observacao,
      porta:gvt_portas(numero_porta, gaveteiro:gvt_gaveteiros(nome, codigo_hardware))
    `)
    .eq('condominio_uid', condominioUid)
    .not('bloco', 'is', null)
    .order('timestamp', { ascending: false })

  if (bloco) {
    query = query.ilike('bloco', `%${bloco}%`)
  }
  
  if (apartamento) {
    query = query.ilike('apartamento', `%${apartamento}%`)
  }

  const { data, error } = await query.limit(100)

  if (error) {
    console.error('Erro ao buscar por bloco/apartamento:', error)
    throw error
  }

  return (data || []).map(mov => ({
    uid: mov.uid,
    porta_uid: mov.porta_uid,
    numero_porta: (mov.porta as any)?.numero_porta || 0,
    gaveteiro_nome: (mov.porta as any)?.gaveteiro?.nome || '',
    gaveteiro_codigo: (mov.porta as any)?.gaveteiro?.codigo_hardware || '',
    bloco: mov.bloco || '',
    apartamento: mov.apartamento || '',
    compartilhada: mov.compartilhada || false,
    acao: mov.acao,
    status_resultante: mov.status_resultante,
    timestamp: mov.timestamp,
    observacao: mov.observacao
  }))
}

// ============================================
// RELATÓRIOS
// ============================================

export interface PortaOcupadaRelatorio {
  porta_uid: string
  numero_porta: number
  gaveteiro_nome: string
  gaveteiro_codigo: string
  ocupado_em: string
  tempo_ocupado_minutos: number
}

export async function listarPortasOcupadas(condominioUid: string): Promise<PortaOcupadaRelatorio[]> {
  // Buscar todas as portas ocupadas com join no gaveteiro
  const { data, error } = await supabase
    .from(TABLES.portas)
    .select(`
      uid,
      numero_porta,
      ocupado_em,
      gaveteiro:gvt_gaveteiros(nome, codigo_hardware)
    `)
    .eq('condominio_uid', condominioUid)
    .eq('status_atual', 'OCUPADO')
    .not('ocupado_em', 'is', null)
    .order('ocupado_em', { ascending: true })

  if (error) {
    console.error('Erro ao listar portas ocupadas:', error)
    throw error
  }

  const agora = new Date()
  
  return (data || []).map(porta => {
    const ocupadoEm = new Date(porta.ocupado_em)
    const diffMs = agora.getTime() - ocupadoEm.getTime()
    const diffMinutos = Math.floor(diffMs / (1000 * 60))
    
    return {
      porta_uid: porta.uid,
      numero_porta: porta.numero_porta,
      gaveteiro_nome: (porta.gaveteiro as any)?.nome || '',
      gaveteiro_codigo: (porta.gaveteiro as any)?.codigo_hardware || '',
      ocupado_em: porta.ocupado_em,
      tempo_ocupado_minutos: diffMinutos
    }
  })
}

export type IotCommandStatus = 'PENDING' | 'ACK' | 'DONE' | 'ERROR' | 'EXPIRED'

export interface IotOpenCommandParams {
  deviceId: string
  portaNumero: number
  pulseMs?: number
  token?: string
}

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function solicitarAberturaPortaIot(params: IotOpenCommandParams): Promise<IotCommandRow> {
  const { deviceId, portaNumero, pulseMs = 800, token } = params

  const payload: any = { portaNumero, pulseMs }
  if (token) payload.token = token

  const { data, error } = await supabase
    .from(TABLES.iot_comandos)
    .insert({
      device_id: deviceId,
      tipo: 'OPEN',
      payload,
      status: 'PENDING'
    })
    .select('uid, device_id, tipo, payload, status, erro, created_at, ack_at, done_at')
    .single()

  if (error) {
    console.error('Erro ao criar comando IoT (OPEN):', error)
    throw error
  }

  return data as any
}

export async function aguardarConclusaoComandoIot(
  comandoUid: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<IotCommandRow> {
  const timeoutMs = opts?.timeoutMs ?? 15000
  const intervalMs = opts?.intervalMs ?? 500
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await supabase
      .from(TABLES.iot_comandos)
      .select('uid, device_id, tipo, payload, status, erro, created_at, ack_at, done_at')
      .eq('uid', comandoUid)
      .single()

    if (error) {
      console.error('Erro ao consultar comando IoT:', error)
      throw error
    }

    const row = data as any as IotCommandRow
    if (row.status === 'DONE' || row.status === 'ERROR' || row.status === 'EXPIRED') {
      return row
    }

    await sleep(intervalMs)
  }

  const { data, error } = await supabase
    .from(TABLES.iot_comandos)
    .select('uid, device_id, tipo, payload, status, erro, created_at, ack_at, done_at')
    .eq('uid', comandoUid)
    .single()

  if (error) {
    console.error('Erro ao consultar comando IoT (timeout):', error)
    throw error
  }

  return data as any

}

export async function buscarUltimoStatusIotPorComando(
  comandoUid: string
): Promise<{ door_state: 'OPEN' | 'CLOSED' | 'UNKNOWN'; sensor_raw: number | null } | null> {
  const { data, error } = await supabase
    .from(TABLES.iot_status)
    .select('door_state, sensor_raw')
    .eq('last_command_uid', comandoUid)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Erro ao buscar status IoT por comando:', error)
    throw error
  }

  const row = (data && data[0]) as any
  if (!row) return null

  return {
    door_state: (row.door_state || 'UNKNOWN') as 'OPEN' | 'CLOSED' | 'UNKNOWN',
    sensor_raw: row.sensor_raw ?? null
  }
}

export interface Esp32OpenParams {
  baseUrl: string
  token: string
  lockId?: number
  numeroPorta?: number  // Numero da porta fisica (1-8)
  timeoutMs?: number
}

export async function abrirPortaEsp32(params: Esp32OpenParams): Promise<{ ok: boolean; message?: string }>{
  const { baseUrl, token, lockId, numeroPorta = 1, timeoutMs = 10000 } = params

  if (!baseUrl || !token) {
    throw new Error('Configuração do ESP32 incompleta (baseUrl/token)')
  }

  // Adiciona parametro ?porta=N para especificar qual porta abrir
  const url = `${baseUrl.replace(/\/$/, '')}/abrir?porta=${numeroPorta}`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Usar POST pois o firmware atual do ESP32 espera POST
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    const text = await res.text()
    console.log('[ESP32] Resposta ABRIR:', res.status, text)
    
    // Verificar se a resposta indica sucesso (HTML ou JSON)
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

export async function fecharPortaEsp32(params: Esp32OpenParams): Promise<{ ok: boolean; message?: string }>{
  const { baseUrl, token, lockId, numeroPorta = 1, timeoutMs = 10000 } = params

  if (!baseUrl || !token) {
    throw new Error('Configuração do ESP32 incompleta (baseUrl/token)')
  }

  // Adiciona parametro ?porta=N para especificar qual porta fechar
  const url = `${baseUrl.replace(/\/$/, '')}/fechar?porta=${numeroPorta}`

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Usar POST pois o firmware atual do ESP32 espera POST
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    const text = await res.text()
    console.log('[ESP32] Resposta FECHAR:', res.status, text)
    
    // Verificar se a resposta indica sucesso (HTML ou JSON)
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

// ============================================
// ATUALIZAR STATUS FÍSICO DA FECHADURA NO BANCO
// ============================================

export async function atualizarStatusFechadura(
  portaUid: string,
  fechaduraStatus: 'aberta' | 'fechada',
  sensorStatus?: 'aberto' | 'fechado' | 'desconhecido'
): Promise<void> {
  const updateData: any = {
    fechadura_status: fechaduraStatus,
    status_fisico_atualizado_em: new Date().toISOString()
  }
  
  if (sensorStatus) {
    updateData.sensor_status = sensorStatus
  }

  const { error } = await supabase
    .from(TABLES.portas)
    .update(updateData)
    .eq('uid', portaUid)

  if (error) {
    console.error('Erro ao atualizar status da fechadura:', error)
    throw error
  }
  
  console.log(`[DB] Porta ${portaUid}: fechadura=${fechaduraStatus}, sensor=${sensorStatus || 'não alterado'}`)
}

// Atualizar status da fechadura por número da porta e gaveteiro
export async function atualizarStatusFechaduraPorNumero(
  gaveteiroUid: string,
  numeroPorta: number,
  fechaduraStatus: 'aberta' | 'fechada',
  sensorStatus?: 'aberto' | 'fechado' | 'desconhecido'
): Promise<void> {
  const updateData: any = {
    fechadura_status: fechaduraStatus,
    status_fisico_atualizado_em: new Date().toISOString()
  }
  
  if (sensorStatus) {
    updateData.sensor_status = sensorStatus
  }

  const { error } = await supabase
    .from(TABLES.portas)
    .update(updateData)
    .eq('gaveteiro_uid', gaveteiroUid)
    .eq('numero_porta', numeroPorta)

  if (error) {
    console.error('Erro ao atualizar status da fechadura:', error)
    throw error
  }
  
  console.log(`[DB] Gaveteiro ${gaveteiroUid}, Porta ${numeroPorta}: fechadura=${fechaduraStatus}`)
}

// Atualizar status do sensor do ímã (magnético)
export async function atualizarSensorImaPorNumero(
  gaveteiroUid: string,
  numeroPorta: number,
  sensorImaStatus: 'aberto' | 'fechado' | 'desconhecido'
): Promise<void> {
  const updateData = {
    sensor_ima_status: sensorImaStatus,
    sensor_ima_atualizado_em: new Date().toISOString()
  }

  const { error } = await supabase
    .from(TABLES.portas)
    .update(updateData)
    .eq('gaveteiro_uid', gaveteiroUid)
    .eq('numero_porta', numeroPorta)

  if (error) {
    console.error('Erro ao atualizar sensor do ímã:', error)
    throw error
  }
  
  console.log(`[DB] Gaveteiro ${gaveteiroUid}, Porta ${numeroPorta}: sensor_ima=${sensorImaStatus}`)
}
