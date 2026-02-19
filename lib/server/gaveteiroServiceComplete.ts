// Serviço server-side completo para operações com Supabase
// Este arquivo contém TODAS as operações que antes eram feitas no frontend

import { supabaseServer } from './supabase'
import type { Condominio, Gaveteiro, Porta, MovimentacaoPorta, ResumoPortas, Morador, Bloco, Apartamento } from '../../src/types/gaveteiro'

const TABLES = {
  condominios: 'gvt_condominios',
  gaveteiros: 'gvt_gaveteiros',
  portas: 'gvt_portas',
  autorizacoes_porta: 'gvt_autorizacoes_porta',
  movimentacoes_porta: 'gvt_movimentacoes_porta',
  senhas_provisorias: 'gvt_senhas_provisorias',
  entregas: 'gvt_entregas',
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
  const { data, error } = await supabaseServer
    .from(TABLES.condominios)
    .select('*')
    .eq('ativo', true)
    .order('nome')

  if (error) throw error
  return data || []
}

export async function buscarCondominio(uid: string): Promise<Condominio | null> {
  const { data, error } = await supabaseServer
    .from(TABLES.condominios)
    .select('*')
    .eq('uid', uid)
    .single()

  if (error) return null
  return data
}

export async function criarCondominio(
  condominio: Omit<Condominio, 'uid' | 'created_at'>
): Promise<Condominio> {
  const { data, error } = await supabaseServer
    .from(TABLES.condominios)
    .insert(condominio)
    .select('*')
    .single()

  if (error) throw error
  return data as Condominio
}

export async function buscarSenhaMestre(condominioUid: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from(TABLES.condominios)
    .select('senha_mestre')
    .eq('uid', condominioUid)
    .single()

  if (error) return null
  return data?.senha_mestre || null
}

export async function validarSenhaCompleta(
  senha: string,
  condominioUid?: string
): Promise<{
  tipo: 'PROVISORIA' | 'MESTRE' | 'INVALIDA'
  senhaUid?: string
  portaUid?: string
  bloco?: string
  apartamento?: string
  porta?: any
  gaveteiro?: any
  condominio?: any
}> {
  const fetchDetalhes = async (portaUid: string, condUid: string) => {
    const { data: porta } = await supabaseServer
      .from(TABLES.portas)
      .select('*')
      .eq('uid', portaUid)
      .single()

    let gaveteiro: any = null
    if (porta?.gaveteiro_uid) {
      const { data: gvt } = await supabaseServer
        .from(TABLES.gaveteiros)
        .select('*')
        .eq('uid', porta.gaveteiro_uid)
        .single()
      gaveteiro = gvt || null
    }

    const { data: condominio } = await supabaseServer
      .from(TABLES.condominios)
      .select('*')
      .eq('uid', condUid)
      .single()

    return { porta: porta || null, gaveteiro, condominio: condominio || null }
  }

  if (condominioUid) {
    const { data: senhaData, error: senhaError } = await supabaseServer
      .from(TABLES.senhas_provisorias)
      .select('uid, porta_uid, bloco, apartamento')
      .eq('condominio_uid', condominioUid)
      .eq('senha', senha)
      .eq('status', 'ATIVA')
      .single()

    if (!senhaError && senhaData) {
      const detalhes = await fetchDetalhes(senhaData.porta_uid, condominioUid)
      return {
        tipo: 'PROVISORIA',
        senhaUid: senhaData.uid,
        portaUid: senhaData.porta_uid,
        bloco: senhaData.bloco,
        apartamento: senhaData.apartamento,
        porta: detalhes.porta,
        gaveteiro: detalhes.gaveteiro,
        condominio: detalhes.condominio
      }
    }

    const senhaMestre = await buscarSenhaMestre(condominioUid)
    if (senhaMestre && senhaMestre === senha) {
      const { data: condominio } = await supabaseServer
        .from(TABLES.condominios)
        .select('*')
        .eq('uid', condominioUid)
        .single()

      return {
        tipo: 'MESTRE',
        condominio: condominio || null
      }
    }

    return { tipo: 'INVALIDA' }
  }

  const { data: senhaData } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .select('uid, porta_uid, bloco, apartamento, condominio_uid')
    .eq('senha', senha)
    .eq('status', 'ATIVA')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (senhaData) {
    const detalhes = await fetchDetalhes(senhaData.porta_uid, senhaData.condominio_uid)
    return {
      tipo: 'PROVISORIA',
      senhaUid: senhaData.uid,
      portaUid: senhaData.porta_uid,
      bloco: senhaData.bloco,
      apartamento: senhaData.apartamento,
      porta: detalhes.porta,
      gaveteiro: detalhes.gaveteiro,
      condominio: detalhes.condominio
    }
  }

  const { data: condominios } = await supabaseServer
    .from(TABLES.condominios)
    .select('*')
    .eq('senha_mestre', senha)
    .limit(1)

  if (condominios && condominios.length > 0) {
    return {
      tipo: 'MESTRE',
      condominio: condominios[0]
    }
  }

  return { tipo: 'INVALIDA' }
}

// ============================================
// GAVETEIROS
// ============================================

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

  data?.forEach((porta: any) => {
    resumo.total++
    switch (porta.status_atual) {
      case 'DISPONIVEL': resumo.disponivel++; break
      case 'OCUPADO': resumo.ocupado++; break
      case 'AGUARDANDO_RETIRADA': resumo.aguardando_retirada++; break
      case 'BAIXADO': resumo.baixado++; break
    }
  })

  return resumo
}

// ============================================
// PORTAS
// ============================================

export async function listarPortas(gaveteiroUid: string): Promise<Porta[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.portas)
    .select('*')
    .eq('gaveteiro_uid', gaveteiroUid)
    .eq('ativo', true)
    .order('numero_porta', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listarTodasPortas(condominioUid: string): Promise<Porta[]> {
  const { data, error } = await supabaseServer
    .from(TABLES.portas)
    .select(`
      *,
      gaveteiros!inner (
        uid,
        nome,
        codigo_hardware
      )
    `)
    .eq('condominio_uid', condominioUid)
    .eq('ativo', true)
    .order('numero_porta', { ascending: true })

  if (error) throw error
  
  // Transformar os dados para incluir informações do gaveteiro
  return (data || []).map(porta => ({
    ...porta,
    gaveteiro_nome: porta.gaveteiros?.nome,
    gaveteiro_codigo: porta.gaveteiros?.codigo_hardware
  }))
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

  const updateData: any = {
    status_atual: novoStatus,
    ultimo_evento_em: agora
  }

  if (novoStatus === 'OCUPADO') {
    updateData.ocupado_em = agora
    updateData.finalizado_em = null
    updateData.bloco_atual = bloco
    updateData.apartamento_atual = apartamento
    updateData.compartilhada = compartilhada || false
  } else if (novoStatus === 'BAIXADO' || novoStatus === 'DISPONIVEL') {
    updateData.finalizado_em = agora
    updateData.bloco_atual = null
    updateData.apartamento_atual = null
    updateData.compartilhada = false
  }

  const { error } = await supabaseServer
    .from(TABLES.portas)
    .update(updateData)
    .eq('uid', portaUid)

  if (error) throw error
}

// ============================================
// SENHAS PROVISÓRIAS
// ============================================

function gerarSenhaAleatoria(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function senhaExiste(condominioUid: string, senha: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .select('uid')
    .eq('condominio_uid', condominioUid)
    .eq('senha', senha)
    .eq('status', 'ATIVA')
    .limit(1)

  return (data?.length || 0) > 0
}

export async function gerarSenhaUnica(condominioUid: string): Promise<string> {
  let tentativas = 0
  const maxTentativas = 100

  while (tentativas < maxTentativas) {
    const senha = gerarSenhaAleatoria()
    const existe = await senhaExiste(condominioUid, senha)
    if (!existe) return senha
    tentativas++
  }

  throw new Error('Não foi possível gerar uma senha única')
}

export async function criarSenhaProvisoria(
  portaUid: string,
  condominioUid: string,
  bloco: string,
  apartamento: string
): Promise<string> {
  const { senha } = await criarSenhaProvisoriaComUid(portaUid, condominioUid, bloco, apartamento)
  return senha
}

async function criarSenhaProvisoriaComUid(
  portaUid: string,
  condominioUid: string,
  bloco: string,
  apartamento: string,
  movimentacaoUid?: string | null
): Promise<{ uid: string; senha: string }> {
  const senha = await gerarSenhaUnica(condominioUid)

  const { data, error } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .insert({
      porta_uid: portaUid,
      condominio_uid: condominioUid,
      bloco,
      apartamento,
      senha,
      status: 'ATIVA',
      movimentacao_uid: movimentacaoUid || null
    })
    .select('uid, senha')
    .single()

  if (error) throw error
  return { uid: (data as any).uid, senha: (data as any).senha }
}

export async function cancelarSenhasPorta(portaUid: string): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .update({ status: 'CANCELADA' })
    .eq('porta_uid', portaUid)
    .eq('status', 'ATIVA')

  if (error) throw error
}

export async function validarSenha(
  condominioUid: string,
  senha: string
): Promise<{ valida: boolean; portaUid?: string; bloco?: string; apartamento?: string }> {
  const { data, error } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .select('porta_uid, bloco, apartamento')
    .eq('condominio_uid', condominioUid)
    .eq('senha', senha)
    .eq('status', 'ATIVA')
    .single()

  if (error || !data) {
    return { valida: false }
  }

  return {
    valida: true,
    portaUid: data.porta_uid,
    bloco: data.bloco,
    apartamento: data.apartamento
  }
}

export async function marcarSenhaUsada(
  condominioUid: string,
  senha: string,
  usuarioUid?: string
): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .update({
      status: 'USADA',
      usada_em: new Date().toISOString(),
      usada_por: usuarioUid
    })
    .eq('condominio_uid', condominioUid)
    .eq('senha', senha)
    .eq('status', 'ATIVA')

  if (error) throw error
}

// ============================================
// MOVIMENTAÇÕES
// ============================================

export async function registrarMovimentacao(
  portaUid: string,
  condominioUid: string,
  acao: string,
  statusResultante: string,
  usuarioUid?: string,
  origem?: string,
  observacao?: string,
  bloco?: string,
  apartamento?: string,
  compartilhada?: boolean,
  senhaUid?: string,
  destinatarios?: Destinatario[]
): Promise<string> {
  // Preenche campos extras (snapshot) para facilitar relatórios
  let condominioNome: string | null = null
  let numeroPorta: number | null = null
  let nomeMorador: string | null = null
  let whatsappMorador: string | null = null
  let emailMorador: string | null = null
  let contatosAdicionaisMov: any = null
  let destinatariosResumo: any = null

  try {
    if (condominioUid) {
      const { data: condominioData } = await supabaseServer
        .from(TABLES.condominios)
        .select('nome')
        .eq('uid', condominioUid)
        .maybeSingle()
      condominioNome = (condominioData as any)?.nome ?? null
    }

    if (portaUid) {
      const { data: portaData } = await supabaseServer
        .from(TABLES.portas)
        .select('numero_porta')
        .eq('uid', portaUid)
        .maybeSingle()
      numeroPorta = typeof portaData?.numero_porta === 'number' ? portaData.numero_porta : null
    }

    const buscarMorador = async (b?: string | null, a?: string | null) => {
      const blocoNorm = typeof b === 'string' ? b.trim() : null
      const aptoNorm = typeof a === 'string' ? a.trim() : null

      const stripLeadingZeros = (v: string) => v.replace(/^0+(?!$)/, '')
      const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))

      const aptoCandidatos = aptoNorm ? unique([aptoNorm, stripLeadingZeros(aptoNorm)]) : []

      const blocoCandidatos = (() => {
        if (!blocoNorm) return []

        const digits = blocoNorm.match(/\d+/)?.[0] ?? null
        const digitsNoZero = digits ? stripLeadingZeros(digits) : null
        const digits2 = digitsNoZero ? digitsNoZero.padStart(2, '0') : null

        // Exemplos suportados:
        // - '02' / '2'
        // - 'Bloco 02' / 'Bloco 2'
        // - qualquer valor original vindo do sistema
        return unique([
          blocoNorm,
          stripLeadingZeros(blocoNorm),
          digits ?? '',
          digitsNoZero ?? '',
          digits2 ?? '',
          digits2 ? `Bloco ${digits2}` : '',
          digitsNoZero ? `Bloco ${digitsNoZero}` : ''
        ])
      })()

      if (condominioUid && aptoNorm) {
        console.log('[MOV][SERVER] buscarMorador:', {
          condominioUid,
          bloco: blocoNorm,
          apartamento: aptoNorm,
          blocoCandidatos,
          aptoCandidatos
        })

        let query = supabaseServer
          .from(TABLES.moradores)
          .select('nome, whatsapp, email, contatos_adicionais')
          .eq('condominio_uid', condominioUid)
          .in('apartamento', aptoCandidatos.length > 0 ? aptoCandidatos : [aptoNorm])
          .eq('ativo', true)
          .eq('deletado', false)

        if (blocoCandidatos.length > 0) {
          query = query.in('bloco', blocoCandidatos)
        } else {
          // Em alguns condomínios o morador não tem bloco (NULL)
          query = query.is('bloco', null)
        }

        const { data: moradorData, error: moradorErr } = await query.maybeSingle()
        if (moradorErr) {
          console.warn('[MOV][SERVER] Erro ao buscar morador (por bloco+apto):', {
            message: (moradorErr as any)?.message,
            details: (moradorErr as any)?.details,
            hint: (moradorErr as any)?.hint,
            code: (moradorErr as any)?.code
          })
        }

        if (moradorData) {
          console.log('[MOV][SERVER] Morador encontrado (por bloco+apto).')
          return moradorData as any
        }

        console.log('[MOV][SERVER] Morador NÃO encontrado (por bloco+apto).')

        // Se houve erro (ex.: múltiplas linhas), tenta pegar 1 registro explicitamente.
        if (moradorErr) {
          try {
            let pickOne = supabaseServer
              .from(TABLES.moradores)
              .select('nome, whatsapp, email, contatos_adicionais')
              .eq('condominio_uid', condominioUid)
              .in('apartamento', aptoCandidatos.length > 0 ? aptoCandidatos : [aptoNorm])
              .eq('ativo', true)
              .eq('deletado', false)

            if (blocoCandidatos.length > 0) {
              pickOne = pickOne.in('bloco', blocoCandidatos)
            } else {
              pickOne = pickOne.is('bloco', null)
            }

            const { data: firstRow } = await pickOne
              .order('updated_at', { ascending: false })
              .limit(1)

            const morador = (firstRow as any)?.[0]
            console.log('[MOV][SERVER] Morador selecionado via fallback limit(1)?', Boolean(morador))
            if (morador) return morador as any
          } catch (e) {
            console.warn('[MOV][SERVER] Falha no fallback limit(1) do morador:', e)
          }
        }

        // Regra de negócio: apartamento pode repetir em blocos diferentes.
        // Se o bloco foi informado e não achou por bloco+apto, NÃO deve tentar apenas pelo apartamento.
        if (blocoNorm) return null

        // Fallback: se não encontrou por bloco+apartamento, tenta apenas pelo apartamento.
        // Só funciona se houver no máximo 1 morador para o apartamento dentro do condomínio.
        const { data: byApto, error: byAptoErr } = await supabaseServer
          .from(TABLES.moradores)
          .select('nome, whatsapp, email, contatos_adicionais')
          .eq('condominio_uid', condominioUid)
          .in('apartamento', aptoCandidatos.length > 0 ? aptoCandidatos : [aptoNorm])
          .eq('ativo', true)
          .eq('deletado', false)
          .maybeSingle()

        if (byAptoErr) {
          console.warn('[MOV][SERVER] Erro ao buscar morador (fallback por apto):', {
            message: (byAptoErr as any)?.message,
            details: (byAptoErr as any)?.details,
            hint: (byAptoErr as any)?.hint,
            code: (byAptoErr as any)?.code
          })

          // Se múltiplos, pega 1 mais recente.
          try {
            const { data: firstRow } = await supabaseServer
              .from(TABLES.moradores)
              .select('nome, whatsapp, email, contatos_adicionais')
              .eq('condominio_uid', condominioUid)
              .in('apartamento', aptoCandidatos.length > 0 ? aptoCandidatos : [aptoNorm])
              .eq('ativo', true)
              .eq('deletado', false)
              .order('updated_at', { ascending: false })
              .limit(1)

            const morador = (firstRow as any)?.[0]
            console.log('[MOV][SERVER] Morador selecionado via fallback apto limit(1)?', Boolean(morador))
            return morador as any
          } catch (e) {
            console.warn('[MOV][SERVER] Falha no fallback apto limit(1) do morador:', e)
          }
        }

        console.log('[MOV][SERVER] Morador encontrado (fallback por apto)?', Boolean(byApto))
        return byApto as any
      }
    }

    if (destinatarios && destinatarios.length > 0) {
      if (destinatarios.length === 1) {
        const d0 = destinatarios[0]
        const morador = await buscarMorador(d0.bloco, d0.apartamento)
        if (morador) {
          nomeMorador = morador.nome ?? null
          whatsappMorador = morador.whatsapp ?? null
          emailMorador = morador.email ?? null
          contatosAdicionaisMov = morador.contatos_adicionais ?? null
        }
      } else {
        const resumo = []
        for (const d of destinatarios) {
          const morador = await buscarMorador(d.bloco, d.apartamento)
          resumo.push({
            bloco: d.bloco,
            apartamento: d.apartamento,
            nome: morador?.nome ?? null,
            whatsapp: morador?.whatsapp ?? null,
            email: morador?.email ?? null,
            contatos_adicionais: morador?.contatos_adicionais ?? []
          })
        }
        destinatariosResumo = resumo
        contatosAdicionaisMov = resumo
      }
    } else if (
      condominioUid &&
      bloco &&
      apartamento &&
      !String(bloco).includes(',') &&
      !String(apartamento).includes(',')
    ) {
      const blocoNorm = typeof bloco === 'string' ? bloco.trim() : null
      const aptoNorm = typeof apartamento === 'string' ? apartamento.trim() : null
      const morador = await buscarMorador(blocoNorm, aptoNorm)
      if (morador) {
        nomeMorador = morador.nome ?? null
        whatsappMorador = morador.whatsapp ?? null
        emailMorador = morador.email ?? null
        contatosAdicionaisMov = morador.contatos_adicionais ?? null
      }
    }
  } catch (e) {
    // Falha ao preencher snapshot não deve impedir a movimentação
    console.warn('[MOV][SERVER] Falha ao preencher campos extras da movimentação:', e)
  }

  const { data, error } = await supabaseServer
    .from(TABLES.movimentacoes_porta)
    .insert({
      porta_uid: portaUid,
      condominio_uid: condominioUid,
      condominio_nome: condominioNome,
      usuario_uid: usuarioUid,
      senha_uid: senhaUid || null,
      acao,
      status_resultante: statusResultante,
      timestamp: new Date().toISOString(),
      origem: origem || 'WEB',
      observacao,
      bloco,
      apartamento,
      compartilhada,
      destinatarios: destinatarios || null,
      destinatarios_resumo: destinatariosResumo,
      // Novas colunas (opcionais)
      numero_porta: numeroPorta,
      nome_morador: nomeMorador,
      whatsapp_morador: whatsappMorador,
      email_morador: emailMorador,
      contatos_adicionais: contatosAdicionaisMov
    })
    .select('uid')
    .single()

  if (error) throw error

  // Segurança extra: alguns ambientes possuem triggers que podem sobrescrever campos.
  // Re-grava explicitamente os snapshots quando calculados.
  try {
    if (
      nomeMorador !== null ||
      whatsappMorador !== null ||
      emailMorador !== null ||
      contatosAdicionaisMov !== null ||
      destinatariosResumo !== null
    ) {
      await supabaseServer
        .from(TABLES.movimentacoes_porta)
        .update({
          nome_morador: nomeMorador,
          whatsapp_morador: whatsappMorador,
          email_morador: emailMorador,
          contatos_adicionais: contatosAdicionaisMov,
          destinatarios_resumo: destinatariosResumo
        })
        .eq('uid', data.uid)
    }
  } catch (e) {
    console.warn('[MOV][SERVER] Falha ao regravar snapshots pós-insert:', e)
  }

  return data.uid
}

// ============================================
// BLOCOS E APARTAMENTOS
// ============================================

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

export async function criarBloco(bloco: Omit<Bloco, 'uid' | 'created_at' | 'updated_at'>): Promise<Bloco> {
  const { data, error } = await supabaseServer
    .from(TABLES.blocos)
    .insert(bloco)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarBloco(uid: string, bloco: Partial<Bloco>): Promise<Bloco> {
  const { data, error } = await supabaseServer
    .from(TABLES.blocos)
    .update({ ...bloco, updated_at: new Date().toISOString() })
    .eq('uid', uid)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function excluirBloco(uid: string): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLES.blocos)
    .update({ ativo: false })
    .eq('uid', uid)

  if (error) throw error
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

export async function criarApartamento(apartamento: Omit<Apartamento, 'uid' | 'created_at' | 'updated_at' | 'bloco'>): Promise<Apartamento> {
  const { data, error } = await supabaseServer
    .from(TABLES.apartamentos)
    .insert(apartamento)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarApartamento(uid: string, apartamento: Partial<Apartamento>): Promise<Apartamento> {
  const { bloco, ...rest } = apartamento // Remove o campo bloco do update
  const { data, error } = await supabaseServer
    .from(TABLES.apartamentos)
    .update(rest)
    .eq('uid', uid)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function excluirApartamento(uid: string): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLES.apartamentos)
    .update({ ativo: false })
    .eq('uid', uid)

  if (error) throw error
}

// ============================================
// MORADORES
// ============================================

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

export async function criarMorador(morador: Omit<Morador, 'uid' | 'created_at' | 'updated_at'>): Promise<Morador> {
  const { data, error } = await supabaseServer
    .from(TABLES.moradores)
    .insert(morador)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarMorador(uid: string, morador: Partial<Morador>): Promise<Morador> {
  const { data, error } = await supabaseServer
    .from(TABLES.moradores)
    .update({ ...morador, updated_at: new Date().toISOString() })
    .eq('uid', uid)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function buscarMorador(uid: string): Promise<Morador | null> {
  const { data, error } = await supabaseServer
    .from(TABLES.moradores)
    .select('*')
    .eq('uid', uid)
    .single()

  if (error) return null
  return data
}

export async function excluirMorador(uid: string): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLES.moradores)
    .update({ ativo: false })
    .eq('uid', uid)

  if (error) throw error
}

export async function adicionarDestinatario(
  portaUid: string,
  condominioUid: string,
  destinatario: { bloco: string; apartamento: string },
  usuarioUid?: string
): Promise<{ sucesso: boolean; senha?: string }> {
  try {
    // Criar senha provisória para o novo destinatário
    const senha = await criarSenhaProvisoria(portaUid, condominioUid, destinatario.bloco, destinatario.apartamento)
    
    // Registrar movimentação de compartilhamento
    await registrarMovimentacao(
      portaUid,
      condominioUid,
      'COMPARTILHAR',
      'OCUPADO',
      usuarioUid,
      'WEB',
      `Adicionado destinatário: ${destinatario.bloco} - Apto ${destinatario.apartamento}`,
      destinatario.bloco,
      destinatario.apartamento,
      true
    )

    return { sucesso: true, senha }
  } catch (error) {
    throw new Error('Erro ao adicionar destinatário')
  }
}

export async function buscarSenhasAtivas(portaUid: string): Promise<Array<{ bloco: string; apartamento: string; senha: string }>> {
  const { data, error } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .select('bloco, apartamento, senha')
    .eq('porta_uid', portaUid)
    .eq('status', 'ATIVA')

  if (error) throw error
  return data || []
}

// ============================================
// ENTREGAS
// ============================================

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

export async function ocuparPorta(params: {
  portaUid: string
  condominioUid: string
  destinatarios: Destinatario[]
  usuarioUid?: string
  observacao?: string
}): Promise<{ sucesso: boolean; senhas: SenhaDestinatario[] }> {
  const { portaUid, condominioUid, destinatarios, usuarioUid, observacao } = params

  const stripLeadingZeros = (v: string) => v.replace(/^0+(?!$)/, '')
  const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))
  const normalizeBlocoCandidates = (bloco?: string | null) => {
    const blocoNorm = typeof bloco === 'string' ? bloco.trim() : null
    if (!blocoNorm) return [] as string[]
    const digits = blocoNorm.match(/\d+/)?.[0] ?? null
    const digitsNoZero = digits ? stripLeadingZeros(digits) : null
    const digits2 = digitsNoZero ? digitsNoZero.padStart(2, '0') : null
    return unique([
      blocoNorm,
      stripLeadingZeros(blocoNorm),
      digits ?? '',
      digitsNoZero ?? '',
      digits2 ?? '',
      digits2 ? `Bloco ${digits2}` : '',
      digitsNoZero ? `Bloco ${digitsNoZero}` : ''
    ])
  }

  const normalizeAptoCandidates = (apto?: string | null) => {
    const aptoNorm = typeof apto === 'string' ? apto.trim() : null
    if (!aptoNorm) return [] as string[]
    return unique([aptoNorm, stripLeadingZeros(aptoNorm)])
  }

  const buscarMoradorSnapshot = async (bloco?: string | null, apartamento?: string | null) => {
    const aptoCands = normalizeAptoCandidates(apartamento)
    const blocoCands = normalizeBlocoCandidates(bloco)
    const aptoNorm = typeof apartamento === 'string' ? apartamento.trim() : null

    if (!condominioUid || !aptoNorm) return null

    let query = supabaseServer
      .from(TABLES.moradores)
      .select('nome, whatsapp, email, contatos_adicionais')
      .eq('condominio_uid', condominioUid)
      .in('apartamento', aptoCands.length > 0 ? aptoCands : [aptoNorm])
      .eq('ativo', true)
      .eq('deletado', false)

    if (blocoCands.length > 0) {
      query = query.in('bloco', blocoCands)
    } else {
      query = query.is('bloco', null)
    }

    const { data, error } = await query.maybeSingle()
    if (!error && data) return data as any

    // Regra de negócio: apartamento pode repetir em blocos diferentes.
    // Se o bloco foi informado e não achou por bloco+apto, NÃO pode fazer fallback apenas por apartamento.
    if (blocoCands.length > 0) return null

    const { data: rows } = await supabaseServer
      .from(TABLES.moradores)
      .select('nome, whatsapp, email, contatos_adicionais')
      .eq('condominio_uid', condominioUid)
      .in('apartamento', aptoCands.length > 0 ? aptoCands : [aptoNorm])
      .eq('ativo', true)
      .eq('deletado', false)
      .is('bloco', null)
      .order('updated_at', { ascending: false })
      .limit(1)

    return (rows as any)?.[0] ?? null
  }

  const existeMoradorAtivoBlocoApto = async (bloco: string, apartamento: string) => {
    const aptoNorm = typeof apartamento === 'string' ? apartamento.trim() : ''
    const blocoNorm = typeof bloco === 'string' ? bloco.trim() : ''

    if (!condominioUid || !blocoNorm || !aptoNorm) return false

    const aptoCands = normalizeAptoCandidates(aptoNorm)
    const blocoCands = normalizeBlocoCandidates(blocoNorm)

    // Sem fallback por apartamento: aqui precisamos bater exatamente bloco+apto (com normalização).
    const { data, error } = await supabaseServer
      .from(TABLES.moradores)
      .select('uid')
      .eq('condominio_uid', condominioUid)
      .in('apartamento', aptoCands.length > 0 ? aptoCands : [aptoNorm])
      .in('bloco', blocoCands.length > 0 ? blocoCands : [blocoNorm])
      .eq('ativo', true)
      .eq('deletado', false)
      .limit(1)

    if (error) return false
    return Array.isArray(data) && data.length > 0
  }

  // Buscar dados do gaveteiro para a porta
  const { data: portaData } = await supabaseServer
    .from(TABLES.portas)
    .select('numero_porta, gaveteiro_uid')
    .eq('uid', portaUid)
    .single()

  let gaveteiroNome: string | undefined
  if (portaData?.gaveteiro_uid) {
    const { data: gavData } = await supabaseServer
      .from(TABLES.gaveteiros)
      .select('nome')
      .eq('uid', portaData.gaveteiro_uid)
      .single()
    gaveteiroNome = gavData?.nome
  }

  const compartilhada = destinatarios.length > 1
  const blocos = destinatarios.map(d => d.bloco).join(', ')
  const apartamentos = destinatarios.map(d => d.apartamento).join(', ')

  let condominioNome: string | null = null
  try {
    const { data: cond } = await supabaseServer
      .from(TABLES.condominios)
      .select('nome')
      .eq('uid', condominioUid)
      .maybeSingle()
    condominioNome = (cond as any)?.nome ?? null
  } catch {
    condominioNome = null
  }

  // Regra de negócio (kiosk/totem): bloquear se não existir morador cadastrado para cada bloco+apto.
  // Apartamento pode repetir em blocos diferentes, então não há fallback por apartamento.
  const destinatariosInvalidos: Array<{ bloco: string; apartamento: string }> = []
  for (const d of destinatarios) {
    const ok = await existeMoradorAtivoBlocoApto(String(d.bloco || '').trim(), String(d.apartamento || '').trim())
    if (!ok) destinatariosInvalidos.push({ bloco: String(d.bloco || '').trim(), apartamento: String(d.apartamento || '').trim() })
  }
  if (destinatariosInvalidos.length > 0) {
    const msg =
      destinatariosInvalidos.length === 1
        ? `Não existe morador cadastrado (ativo) para Bloco ${destinatariosInvalidos[0].bloco} - Apto ${destinatariosInvalidos[0].apartamento}.`
        : `Não existem moradores cadastrados (ativos) para: ${destinatariosInvalidos
            .map(i => `Bloco ${i.bloco} - Apto ${i.apartamento}`)
            .join('; ')}.`
    throw new Error(msg)
  }

  // Atualizar status da porta
  await atualizarStatusPorta(portaUid, 'OCUPADO', usuarioUid, blocos, apartamentos, compartilhada)

  // Registrar movimentação
  const movimentacaoUid = await registrarMovimentacao(
    portaUid,
    condominioUid,
    'OCUPADO',
    'OCUPADO',
    usuarioUid,
    'TOTEM',
    observacao,
    blocos,
    apartamentos,
    compartilhada,
    undefined,
    destinatarios
  )

  // Gerar senhas e criar entregas para cada destinatário
  const senhas: SenhaDestinatario[] = []
  const totalSenhas = destinatarios.reduce((acc, d) => acc + (d.quantidade || 1), 0)
  let senhaUidUnica: string | null = null

  for (const dest of destinatarios) {
    const qtd = dest.quantidade || 1
    for (let i = 0; i < qtd; i++) {
      let senhaUidAtual: string | null = null
      if (totalSenhas === 1) {
        const created = await criarSenhaProvisoriaComUid(portaUid, condominioUid, dest.bloco, dest.apartamento, movimentacaoUid)
        senhaUidAtual = created.uid
        senhaUidUnica = created.uid
        senhas.push({ bloco: dest.bloco, apartamento: dest.apartamento, senha: created.senha })
      } else {
        const created = await criarSenhaProvisoriaComUid(portaUid, condominioUid, dest.bloco, dest.apartamento, movimentacaoUid)
        senhaUidAtual = created.uid
        senhas.push({ bloco: dest.bloco, apartamento: dest.apartamento, senha: created.senha })
      }

      // Criar registro de entrega
      await supabaseServer
        .from(TABLES.entregas)
        .insert({
          movimentacao_uid: movimentacaoUid,
          porta_uid: portaUid,
          condominio_uid: condominioUid,
          senha_uid: senhaUidAtual,
          bloco: dest.bloco,
          apartamento: dest.apartamento,
          quantidade: 1,
          status: 'PENDENTE',
          ocupado_em: new Date().toISOString(),
          numero_porta: portaData?.numero_porta,
          gaveteiro_nome: gaveteiroNome,
          observacao,
          compartilhada
        })
    }
  }

  // Se houve exatamente 1 senha gerada, vincular a movimentação OCUPAR a essa senha
  if (totalSenhas === 1 && senhaUidUnica) {
    try {
      await supabaseServer
        .from(TABLES.movimentacoes_porta)
        .update({ senha_uid: senhaUidUnica })
        .eq('uid', movimentacaoUid)
    } catch (e) {
      console.warn('[MOV][SERVER] Falha ao vincular senha_uid na movimentação de OCUPAR:', e)
    }
  }

  try {
    const destinatariosEnriquecidos = [] as any[]
    for (const s of senhas) {
      const morador = await buscarMoradorSnapshot(s.bloco, s.apartamento)
      destinatariosEnriquecidos.push({
        bloco: s.bloco,
        apartamento: s.apartamento,
        senha: s.senha,
        status: 'ATIVA',
        numero_porta: portaData?.numero_porta ?? null,
        condominio_nome: condominioNome,
        nome_morador: morador?.nome ?? null,
        whatsapp_morador: morador?.whatsapp ?? null,
        email_morador: morador?.email ?? null,
        contatos_adicionais: morador?.contatos_adicionais ?? []
      })
    }

    const destinatariosResumoComSenha = (() => {
      const map = new Map<string, any>()

      for (const d of destinatariosEnriquecidos) {
        const key = `${String(d.bloco ?? '')}::${String(d.apartamento ?? '')}`
        const existing = map.get(key)
        if (existing) {
          existing.senhas = [...(existing.senhas || []), d.senha].filter(Boolean)
          continue
        }

        map.set(key, {
          bloco: d.bloco,
          apartamento: d.apartamento,
          nome: d.nome_morador ?? null,
          whatsapp: d.whatsapp_morador ?? null,
          email: d.email_morador ?? null,
          contatos_adicionais: d.contatos_adicionais ?? [],
          senhas: d.senha ? [d.senha] : [],
          status: d.status ?? 'ATIVA'
        })
      }

      return Array.from(map.values())
    })()

    if (destinatariosEnriquecidos.length > 0) {
      await supabaseServer
        .from(TABLES.movimentacoes_porta)
        .update({
          destinatarios: destinatariosEnriquecidos,
          destinatarios_resumo: destinatariosResumoComSenha
        })
        .eq('uid', movimentacaoUid)
    }
  } catch (e) {
    console.warn('[MOV][SERVER] Falha ao enriquecer destinatarios na movimentação:', e)
  }

  return { sucesso: true, senhas }
}

export async function cancelarOcupacao(
  portaUid: string,
  condominioUid: string,
  motivo: string,
  usuarioUid?: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    await cancelarSenhasPorta(portaUid)
    await atualizarStatusPorta(portaUid, 'DISPONIVEL', usuarioUid)

    // Buscar a movimentação existente (OCUPAR) desta porta para EDITAR
    const { data: movimentacaoExistente } = await supabaseServer
      .from(TABLES.movimentacoes_porta)
      .select('uid, observacao')
      .eq('porta_uid', portaUid)
      .in('acao', ['OCUPAR', 'OCUPADO'])
      .eq('status_resultante', 'OCUPADO')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    // EDITAR a movimentação existente (não criar nova linha)
    if (movimentacaoExistente) {
      await supabaseServer
        .from(TABLES.movimentacoes_porta)
        .update({
          acao: 'cancelado',
          status_resultante: 'DISPONIVEL',
          cancelado: true,
          observacao: `${(movimentacaoExistente as any).observacao || ''} | CANCELADO: ${motivo}`.trim(),
          timestamp: new Date().toISOString()
        })
        .eq('uid', movimentacaoExistente.uid)
    }

    // Atualizar entregas pendentes para CANCELADO (não deletar)
    const { error: erroEntregas } = await supabaseServer
      .from(TABLES.entregas)
      .update({
        status: 'CANCELADO',
        cancelado_em: new Date().toISOString(),
        cancelado_por: usuarioUid || null
      })
      .eq('porta_uid', portaUid)
      .eq('status', 'PENDENTE')

    if (erroEntregas) {
      console.error('Erro ao atualizar entregas para cancelado:', erroEntregas)
    }

    return { sucesso: true, mensagem: 'Ocupação cancelada com sucesso.' }
  } catch (error) {
    return { sucesso: false, mensagem: 'Erro ao cancelar ocupação.' }
  }
}

export async function darBaixaPorta(portaUid: string, condominioUid: string, usuarioUid?: string): Promise<void> {
  await atualizarStatusPorta(portaUid, 'BAIXADO', usuarioUid)
  await registrarMovimentacao(portaUid, condominioUid, 'BAIXAR', 'BAIXADO', usuarioUid, 'WEB')
}

export async function liberarPorta(portaUid: string, condominioUid: string, usuarioUid?: string): Promise<void> {
  await cancelarSenhasPorta(portaUid)
  await atualizarStatusPorta(portaUid, 'DISPONIVEL', usuarioUid)
  await registrarMovimentacao(portaUid, condominioUid, 'LIBERAR', 'DISPONIVEL', usuarioUid, 'WEB')
}

// ============================================
// IOT
// ============================================

export async function solicitarAberturaPortaIot(params: {
  deviceId: string
  portaNumero: number
  pulseMs?: number
  token?: string
}): Promise<{ comandoUid: string }> {
  const { deviceId, portaNumero, pulseMs = 800 } = params

  const { data, error } = await supabaseServer
    .from(TABLES.iot_comandos)
    .insert({
      device_id: deviceId,
      comando: 'ABRIR_PORTA',
      parametros: { porta: portaNumero, pulse_ms: pulseMs },
      status: 'PENDENTE',
      created_at: new Date().toISOString()
    })
    .select('uid')
    .single()

  if (error) throw error
  return { comandoUid: data.uid }
}

export async function aguardarConclusaoComandoIot(
  comandoUid: string,
  timeoutMs: number = 10000
): Promise<{ sucesso: boolean; status: string }> {
  const inicio = Date.now()

  while (Date.now() - inicio < timeoutMs) {
    const { data } = await supabaseServer
      .from(TABLES.iot_comandos)
      .select('status')
      .eq('uid', comandoUid)
      .single()

    if (data?.status === 'EXECUTADO') {
      return { sucesso: true, status: 'EXECUTADO' }
    }
    if (data?.status === 'ERRO') {
      return { sucesso: false, status: 'ERRO' }
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return { sucesso: false, status: 'TIMEOUT' }
}

export async function consultarComandoIot(comandoUid: string): Promise<any> {
  const { data, error } = await supabaseServer
    .from(TABLES.iot_comandos)
    .select('*')
    .eq('uid', comandoUid)
    .single()

  if (error) throw error
  return data
}

export async function liberarPortaComSenha(
  portaUid: string,
  condominioUid: string,
  senha: string,
  usuarioUid?: string
): Promise<{ sucesso: boolean; mensagem: string; portaUid?: string }> {
  // Captura o UID da senha ATIVA para registrar na movimentação (FK)
  let senhaUid: string | null = null
  try {
    const { data } = await supabaseServer
      .from(TABLES.senhas_provisorias)
      .select('uid')
      .eq('condominio_uid', condominioUid)
      .eq('senha', senha)
      .eq('status', 'ATIVA')
      .maybeSingle()
    senhaUid = (data as any)?.uid ?? null
  } catch {
    // Não bloqueia o fluxo se não conseguir obter o UID
  }

  const validacao = await validarSenha(condominioUid, senha)

  if (!validacao.valida || !validacao.portaUid) {
    return { sucesso: false, mensagem: 'Senha inválida ou já utilizada.' }
  }

  await marcarSenhaUsada(condominioUid, senha, usuarioUid)

  // Registrar movimentação de retirada (sempre que a senha for consumida)
  try {
    await registrarMovimentacao(
      validacao.portaUid,
      condominioUid,
      'RETIRADA',
      'OCUPADO',
      usuarioUid,
      'TOTEM',
      `Retirada - Bloco ${validacao.bloco} Apto ${validacao.apartamento}`,
      validacao.bloco,
      validacao.apartamento,
      undefined,
      senhaUid || undefined
    )
  } catch (e) {
    console.warn('[MOV][SERVER] Falha ao registrar movimentação de retirada:', e)
  }

  // Atualizar entrega para RETIRADO
  await supabaseServer
    .from(TABLES.entregas)
    .update({
      status: 'RETIRADO',
      retirado_em: new Date().toISOString(),
      retirado_por: usuarioUid || null
    })
    .eq('porta_uid', validacao.portaUid)
    .eq('bloco', validacao.bloco)
    .eq('apartamento', validacao.apartamento)
    .eq('status', 'PENDENTE')

  // Verificar se ainda há senhas ativas para esta porta
  const { data: senhasRestantes } = await supabaseServer
    .from(TABLES.senhas_provisorias)
    .select('uid')
    .eq('porta_uid', validacao.portaUid)
    .eq('status', 'ATIVA')

  if (!senhasRestantes || senhasRestantes.length === 0) {
    await atualizarStatusPorta(validacao.portaUid, 'DISPONIVEL', usuarioUid)
    await registrarMovimentacao(
      validacao.portaUid,
      condominioUid,
      'RETIRAR',
      'DISPONIVEL',
      usuarioUid,
      'TOTEM',
      `Última retirada - Bloco ${validacao.bloco} Apto ${validacao.apartamento}`,
      undefined,
      undefined,
      undefined,
      senhaUid || undefined
    )
  }

  return {
    sucesso: true,
    mensagem: 'Porta liberada com sucesso!',
    portaUid: validacao.portaUid
  }
}

// ============================================
// RELATÓRIOS
// ============================================

export interface PortaOcupadaRelatorio {
  porta_uid: string
  numero_porta: number
  gaveteiro_nome: string
  bloco: string
  apartamento: string
  ocupado_em: string
  tempo_ocupado_minutos: number
  compartilhada: boolean
}

export async function listarPortasOcupadas(condominioUid: string): Promise<PortaOcupadaRelatorio[]> {
  const gaveteiros = await listarGaveteiros(condominioUid)
  const resultado: PortaOcupadaRelatorio[] = []
  const agora = new Date()

  for (const gav of gaveteiros) {
    const { data: portas } = await supabaseServer
      .from(TABLES.portas)
      .select('*')
      .eq('gaveteiro_uid', gav.uid)
      .eq('status_atual', 'OCUPADO')

    for (const porta of portas || []) {
      const ocupadoEm = porta.ocupado_em ? new Date(porta.ocupado_em) : agora
      const tempoMinutos = Math.floor((agora.getTime() - ocupadoEm.getTime()) / 60000)

      resultado.push({
        porta_uid: porta.uid,
        numero_porta: porta.numero_porta,
        gaveteiro_nome: gav.nome,
        bloco: porta.bloco_atual || '',
        apartamento: porta.apartamento_atual || '',
        ocupado_em: porta.ocupado_em || '',
        tempo_ocupado_minutos: tempoMinutos,
        compartilhada: porta.compartilhada || false
      })
    }
  }

  return resultado.sort((a, b) => b.tempo_ocupado_minutos - a.tempo_ocupado_minutos)
}

export interface MovimentacaoBlocoApartamento {
  uid: string
  porta_uid: string
  numero_porta: number
  gaveteiro_nome: string
  acao: string
  status_resultante: string
  timestamp: string
  bloco: string
  apartamento: string
}

export async function buscarPorBlocoApartamento(
  condominioUid: string,
  bloco: string,
  apartamento?: string
): Promise<MovimentacaoBlocoApartamento[]> {
  let query = supabaseServer
    .from(TABLES.movimentacoes_porta)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .ilike('bloco', `%${bloco}%`)

  if (apartamento) {
    query = query.ilike('apartamento', `%${apartamento}%`)
  }

  const { data, error } = await query
    .order('timestamp', { ascending: false })
    .limit(100)

  if (error) throw error
  return data as any
}

// ============================================
// ATUALIZAR STATUS FÍSICO
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

  const { error } = await supabaseServer
    .from(TABLES.portas)
    .update(updateData)
    .eq('uid', portaUid)

  if (error) throw error
}

// ============================================
// GERENCIAMENTO DE ARMÁRIOS
// ============================================

export interface PortaComDetalhes {
  uid: string
  numero_porta: number
  status_atual: string
  ocupado_em?: string
  bloco_atual?: string
  apartamento_atual?: string
  compartilhada?: boolean
  gaveteiro_uid: string
  gaveteiro_nome?: string
  tempo_ocupado_minutos?: number
}

export async function listarPortasGerenciamento(condominioUid: string): Promise<PortaComDetalhes[]> {
  // Buscar gaveteiros do condomínio
  const gaveteiros = await listarGaveteiros(condominioUid)
  const resultado: PortaComDetalhes[] = []
  const agora = new Date()

  for (const gav of gaveteiros) {
    const portas = await listarPortas(gav.uid)
    
    for (const porta of portas) {
      let tempoOcupadoMinutos: number | undefined
      if (porta.status_atual === 'OCUPADO' && porta.ocupado_em) {
        const ocupadoEm = new Date(porta.ocupado_em)
        tempoOcupadoMinutos = Math.floor((agora.getTime() - ocupadoEm.getTime()) / 60000)
      }

      resultado.push({
        uid: porta.uid,
        numero_porta: porta.numero_porta,
        status_atual: porta.status_atual,
        ocupado_em: porta.ocupado_em,
        bloco_atual: porta.bloco_atual,
        apartamento_atual: porta.apartamento_atual,
        compartilhada: porta.compartilhada,
        gaveteiro_uid: porta.gaveteiro_uid,
        gaveteiro_nome: gav.nome,
        tempo_ocupado_minutos: tempoOcupadoMinutos
      })
    }
  }

  return resultado.sort((a, b) => a.numero_porta - b.numero_porta)
}

export interface EntregaGerenciamento {
  uid: string
  porta_uid: string
  bloco: string
  apartamento: string
  quantidade: number
  status: string
  ocupado_em?: string
  retirado_em?: string
  cancelado_em?: string
  created_at: string
  numero_porta?: number
  gaveteiro_nome?: string
  observacao?: string
  tempo_ocupado_minutos?: number
}

export async function listarEntregasGerenciamento(
  condominioUid: string,
  filtros?: {
    status?: string
    bloco?: string
    apartamento?: string
    dataInicio?: string
    dataFim?: string
  }
): Promise<EntregaGerenciamento[]> {
  let query = supabaseServer
    .from(TABLES.entregas)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .order('ocupado_em', { ascending: false })

  if (filtros?.status) {
    query = query.eq('status', filtros.status)
  }
  if (filtros?.bloco) {
    query = query.ilike('bloco', `%${filtros.bloco}%`)
  }
  if (filtros?.apartamento) {
    query = query.ilike('apartamento', `%${filtros.apartamento}%`)
  }
  if (filtros?.dataInicio) {
    query = query.gte('ocupado_em', filtros.dataInicio)
  }
  if (filtros?.dataFim) {
    query = query.lte('ocupado_em', filtros.dataFim)
  }

  const { data, error } = await query.limit(500)

  if (error) throw error

  const agora = new Date()

  return (data || []).map((e: any) => {
    let tempoOcupadoMinutos: number | undefined
    if (e.status === 'PENDENTE' && e.ocupado_em) {
      const ocupadoEm = new Date(e.ocupado_em)
      tempoOcupadoMinutos = Math.floor((agora.getTime() - ocupadoEm.getTime()) / 60000)
    }

    return {
      ...e,
      tempo_ocupado_minutos: tempoOcupadoMinutos
    }
  })
}

export async function atualizarStatusEntrega(
  entregaUid: string,
  novoStatus: string,
  usuarioUid?: string
): Promise<void> {
  const updateData: any = { status: novoStatus }
  const agora = new Date().toISOString()

  if (novoStatus === 'RETIRADO') {
    updateData.retirado_em = agora
    updateData.retirado_por = usuarioUid || null
  } else if (novoStatus === 'CANCELADO') {
    updateData.cancelado_em = agora
    updateData.cancelado_por = usuarioUid || null
  }

  const { error } = await supabaseServer
    .from(TABLES.entregas)
    .update(updateData)
    .eq('uid', entregaUid)

  if (error) throw error
}

export async function obterEstatisticasArmario(condominioUid: string): Promise<{
  totalPortas: number
  portasLivres: number
  portasOcupadas: number
  entregasPendentes: number
  entregasHoje: number
  entregasSemana: number
  tempoMedioOcupacao: number
}> {
  // Buscar portas
  const gaveteiros = await listarGaveteiros(condominioUid)
  let totalPortas = 0
  let portasLivres = 0
  let portasOcupadas = 0
  let somaMinutos = 0
  let countOcupadas = 0
  const agora = new Date()

  for (const gav of gaveteiros) {
    const portas = await listarPortas(gav.uid)
    totalPortas += portas.length
    
    for (const porta of portas) {
      if (porta.status_atual === 'DISPONIVEL') {
        portasLivres++
      } else if (porta.status_atual === 'OCUPADO') {
        portasOcupadas++
        if (porta.ocupado_em) {
          const ocupadoEm = new Date(porta.ocupado_em)
          somaMinutos += Math.floor((agora.getTime() - ocupadoEm.getTime()) / 60000)
          countOcupadas++
        }
      }
    }
  }

  const tempoMedioOcupacao = countOcupadas > 0 ? Math.floor(somaMinutos / countOcupadas) : 0

  // Buscar entregas
  const { data: entregasPendentesData } = await supabaseServer
    .from(TABLES.entregas)
    .select('uid')
    .eq('condominio_uid', condominioUid)
    .eq('status', 'PENDENTE')

  const entregasPendentes = entregasPendentesData?.length || 0

  // Entregas de hoje
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)
  
  const { data: entregasHojeData } = await supabaseServer
    .from(TABLES.entregas)
    .select('uid')
    .eq('condominio_uid', condominioUid)
    .gte('ocupado_em', inicioHoje.toISOString())

  const entregasHoje = entregasHojeData?.length || 0

  // Entregas da semana
  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - 7)
  
  const { data: entregasSemanaData } = await supabaseServer
    .from(TABLES.entregas)
    .select('uid')
    .eq('condominio_uid', condominioUid)
    .gte('ocupado_em', inicioSemana.toISOString())

  const entregasSemana = entregasSemanaData?.length || 0

  return {
    totalPortas,
    portasLivres,
    portasOcupadas,
    entregasPendentes,
    entregasHoje,
    entregasSemana,
    tempoMedioOcupacao
  }
}

// ============================================
// RELATÓRIOS AVANÇADOS
// ============================================

export interface RelatorioPorta {
  porta_uid: string
  numero_porta: number
  gaveteiro_nome: string
  total_ocupacoes: number
  total_retiradas: number
  total_cancelamentos: number
  tempo_medio_ocupacao_minutos: number
  ultima_ocupacao?: string
  ultima_retirada?: string
}

export interface MovimentacaoHistorico {
  uid: string
  porta_uid: string
  numero_porta?: number
  acao: string
  status_resultante: string
  timestamp: string
  bloco?: string
  apartamento?: string
  observacao?: string
}

export interface EstatisticasPeriodo {
  periodo: string
  total_ocupacoes: number
  total_retiradas: number
  total_cancelamentos: number
  tempo_medio_minutos: number
}

export async function obterRelatorioPorta(portaUid: string): Promise<RelatorioPorta | null> {
  // Buscar dados da porta
  const { data: porta } = await supabaseServer
    .from(TABLES.portas)
    .select('uid, numero_porta, gaveteiro_uid')
    .eq('uid', portaUid)
    .single()

  if (!porta) return null

  // Buscar nome do gaveteiro
  const { data: gaveteiro } = await supabaseServer
    .from(TABLES.gaveteiros)
    .select('nome')
    .eq('uid', porta.gaveteiro_uid)
    .single()

  // Buscar movimentações da porta
  const { data: movimentacoes } = await supabaseServer
    .from(TABLES.movimentacoes_porta)
    .select('acao, timestamp')
    .eq('porta_uid', portaUid)
    .order('timestamp', { ascending: false })

  // Buscar entregas da porta
  const { data: entregas } = await supabaseServer
    .from(TABLES.entregas)
    .select('status, ocupado_em, retirado_em')
    .eq('porta_uid', portaUid)

  const totalOcupacoes = movimentacoes?.filter((m: any) => m.acao === 'OCUPAR' || m.acao === 'OCUPADO').length || 0
  const totalRetiradas = entregas?.filter((e: any) => e.status === 'RETIRADO').length || 0
  const totalCancelamentos = entregas?.filter((e: any) => e.status === 'CANCELADO').length || 0

  // Calcular tempo médio de ocupação
  let somaTempoMinutos = 0
  let countComTempo = 0
  entregas?.forEach((e: any) => {
    if (e.ocupado_em && e.retirado_em) {
      const ocupado = new Date(e.ocupado_em)
      const retirado = new Date(e.retirado_em)
      somaTempoMinutos += Math.floor((retirado.getTime() - ocupado.getTime()) / 60000)
      countComTempo++
    }
  })

  const tempoMedioOcupacaoMinutos = countComTempo > 0 ? Math.floor(somaTempoMinutos / countComTempo) : 0

  // Última ocupação e retirada
  const ultimaOcupacao = movimentacoes?.find((m: any) => m.acao === 'OCUPAR' || m.acao === 'OCUPADO')?.timestamp
  const ultimaRetirada = entregas?.find((e: any) => e.status === 'RETIRADO')?.retirado_em

  return {
    porta_uid: porta.uid,
    numero_porta: porta.numero_porta,
    gaveteiro_nome: gaveteiro?.nome || '',
    total_ocupacoes: totalOcupacoes,
    total_retiradas: totalRetiradas,
    total_cancelamentos: totalCancelamentos,
    tempo_medio_ocupacao_minutos: tempoMedioOcupacaoMinutos,
    ultima_ocupacao: ultimaOcupacao,
    ultima_retirada: ultimaRetirada
  }
}

export async function obterHistoricoMovimentacoes(
  condominioUid: string,
  filtros?: {
    portaUid?: string
    bloco?: string
    apartamento?: string
    dataInicio?: string
    dataFim?: string
    limite?: number
  }
): Promise<MovimentacaoHistorico[]> {
  let query = supabaseServer
    .from(TABLES.movimentacoes_porta)
    .select('*')
    .eq('condominio_uid', condominioUid)
    .order('timestamp', { ascending: false })

  if (filtros?.portaUid) {
    query = query.eq('porta_uid', filtros.portaUid)
  }
  if (filtros?.bloco) {
    query = query.ilike('bloco', `%${filtros.bloco}%`)
  }
  if (filtros?.apartamento) {
    query = query.ilike('apartamento', `%${filtros.apartamento}%`)
  }
  if (filtros?.dataInicio) {
    query = query.gte('timestamp', filtros.dataInicio)
  }
  if (filtros?.dataFim) {
    query = query.lte('timestamp', filtros.dataFim)
  }

  const { data, error } = await query.limit(filtros?.limite || 100)

  if (error) throw error
  return data || []
}

export async function obterEstatisticasPorPeriodo(
  condominioUid: string,
  periodo: 'dia' | 'semana' | 'mes' | 'ano'
): Promise<EstatisticasPeriodo[]> {
  const agora = new Date()
  const resultados: EstatisticasPeriodo[] = []

  let numPeriodos = 7
  let formatoPeriodo = ''
  
  switch (periodo) {
    case 'dia':
      numPeriodos = 7
      break
    case 'semana':
      numPeriodos = 4
      break
    case 'mes':
      numPeriodos = 12
      break
    case 'ano':
      numPeriodos = 3
      break
  }

  for (let i = 0; i < numPeriodos; i++) {
    let dataInicio = new Date(agora)
    let dataFim = new Date(agora)
    let label = ''

    switch (periodo) {
      case 'dia':
        dataInicio.setDate(agora.getDate() - i)
        dataInicio.setHours(0, 0, 0, 0)
        dataFim.setDate(agora.getDate() - i)
        dataFim.setHours(23, 59, 59, 999)
        label = dataInicio.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
        break
      case 'semana':
        dataInicio.setDate(agora.getDate() - (i * 7) - 6)
        dataInicio.setHours(0, 0, 0, 0)
        dataFim.setDate(agora.getDate() - (i * 7))
        dataFim.setHours(23, 59, 59, 999)
        label = `Sem ${i + 1}`
        break
      case 'mes':
        dataInicio.setMonth(agora.getMonth() - i, 1)
        dataInicio.setHours(0, 0, 0, 0)
        dataFim.setMonth(agora.getMonth() - i + 1, 0)
        dataFim.setHours(23, 59, 59, 999)
        label = dataInicio.toLocaleDateString('pt-BR', { month: 'short' })
        break
      case 'ano':
        dataInicio.setFullYear(agora.getFullYear() - i, 0, 1)
        dataInicio.setHours(0, 0, 0, 0)
        dataFim.setFullYear(agora.getFullYear() - i, 11, 31)
        dataFim.setHours(23, 59, 59, 999)
        label = dataInicio.getFullYear().toString()
        break
    }

    // Buscar entregas do período
    const { data: entregas } = await supabaseServer
      .from(TABLES.entregas)
      .select('status, ocupado_em, retirado_em')
      .eq('condominio_uid', condominioUid)
      .gte('ocupado_em', dataInicio.toISOString())
      .lte('ocupado_em', dataFim.toISOString())

    const totalOcupacoes = entregas?.length || 0
    const totalRetiradas = entregas?.filter((e: any) => e.status === 'RETIRADO').length || 0
    const totalCancelamentos = entregas?.filter((e: any) => e.status === 'CANCELADO').length || 0

    // Calcular tempo médio
    let somaMinutos = 0
    let count = 0
    entregas?.forEach((e: any) => {
      if (e.ocupado_em && e.retirado_em) {
        const ocupado = new Date(e.ocupado_em)
        const retirado = new Date(e.retirado_em)
        somaMinutos += Math.floor((retirado.getTime() - ocupado.getTime()) / 60000)
        count++
      }
    })

    resultados.push({
      periodo: label,
      total_ocupacoes: totalOcupacoes,
      total_retiradas: totalRetiradas,
      total_cancelamentos: totalCancelamentos,
      tempo_medio_minutos: count > 0 ? Math.floor(somaMinutos / count) : 0
    })
  }

  return resultados.reverse()
}

export async function obterRelatorioBlocoApartamento(
  condominioUid: string,
  bloco?: string,
  apartamento?: string
): Promise<{
  bloco: string
  apartamento: string
  total_entregas: number
  total_retiradas: number
  total_cancelamentos: number
  total_pendentes: number
  tempo_medio_minutos: number
  portas_utilizadas: number[]
}[]> {
  let query = supabaseServer
    .from(TABLES.entregas)
    .select('bloco, apartamento, status, ocupado_em, retirado_em, numero_porta')
    .eq('condominio_uid', condominioUid)

  if (bloco) {
    query = query.ilike('bloco', `%${bloco}%`)
  }
  if (apartamento) {
    query = query.ilike('apartamento', `%${apartamento}%`)
  }

  const { data, error } = await query.limit(1000)

  if (error) throw error

  // Agrupar por bloco/apartamento
  const agrupado: { [key: string]: any[] } = {}
  data?.forEach((e: any) => {
    const chave = `${e.bloco}|${e.apartamento}`
    if (!agrupado[chave]) agrupado[chave] = []
    agrupado[chave].push(e)
  })

  return Object.entries(agrupado).map(([chave, entregas]) => {
    const [blocoVal, aptoVal] = chave.split('|')
    const retiradas = entregas.filter(e => e.status === 'RETIRADO')
    const canceladas = entregas.filter(e => e.status === 'CANCELADO')
    const pendentes = entregas.filter(e => e.status === 'PENDENTE')

    let somaMinutos = 0
    let count = 0
    retiradas.forEach(e => {
      if (e.ocupado_em && e.retirado_em) {
        const ocupado = new Date(e.ocupado_em)
        const retirado = new Date(e.retirado_em)
        somaMinutos += Math.floor((retirado.getTime() - ocupado.getTime()) / 60000)
        count++
      }
    })

    const portasSet = new Set<number>()
    entregas.forEach(e => {
      if (e.numero_porta) portasSet.add(e.numero_porta)
    })

    return {
      bloco: blocoVal,
      apartamento: aptoVal,
      total_entregas: entregas.length,
      total_retiradas: retiradas.length,
      total_cancelamentos: canceladas.length,
      total_pendentes: pendentes.length,
      tempo_medio_minutos: count > 0 ? Math.floor(somaMinutos / count) : 0,
      portas_utilizadas: Array.from(portasSet).sort((a, b) => a - b)
    }
  }).sort((a, b) => {
    if (a.bloco !== b.bloco) return a.bloco.localeCompare(b.bloco)
    return a.apartamento.localeCompare(b.apartamento)
  })
}

export { TABLES }
