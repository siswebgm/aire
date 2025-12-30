import { NextApiRequest, NextApiResponse } from 'next'
import { PortasRepository } from '../../../src/repositories/portas.repository'
import { CondominiosRepository } from '../../../src/repositories/condominios.repository'
import { GaveteirosRepository } from '../../../src/repositories/gaveteiros.repository'
import { ESPService } from '../../../src/services/esp.service'

interface AbrirPortaRequest {
  porta_uid: string
  condominio_uid: string
  usuario_uid?: string // Opcional, pode vir do contexto de autenticação
  cliente_uid?: string // Opcional, para registrar cliente
  bloco?: string // Opcional, para registrar bloco
  apartamento?: string // Opcional, para registrar apartamento
}

interface AbrirPortaResponse {
  sucesso: boolean
  mensagem: string
  dados?: {
    porta_uid: string
    numero_porta: number
    aberto_em: string
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AbrirPortaResponse>
) {
  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({
      sucesso: false,
      mensagem: 'Método não permitido'
    })
  }

  try {
    const { porta_uid, condominio_uid, usuario_uid, cliente_uid, bloco, apartamento }: AbrirPortaRequest = req.body

    // Validações básicas
    if (!porta_uid || !condominio_uid) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'porta_uid e condominio_uid são obrigatórios'
      })
    }

    // TODO: Implementar validação de autenticação do usuário
    // Por enquanto, vamos assumir que o usuário está autenticado
    // const usuarioAutenticado = await validarUsuario(req)
    // if (!usuarioAutenticado) {
    //   return res.status(401).json({
    //     sucesso: false,
    //     mensagem: 'Não autorizado'
    //   })
    // }

    console.log(`[API] Solicitação de abertura da porta ${porta_uid}`)

    // 1. Buscar informações da porta (com filtro de condomínio)
    const porta = await PortasRepository.buscarPorUid(porta_uid, condominio_uid)
    if (!porta) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Porta não encontrada neste condomínio'
      })
    }

    // 2. Verificar se o condomínio está ativo
    const condominioAtivo = await CondominiosRepository.verificarAtivo(condominio_uid)
    if (!condominioAtivo) {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Condomínio inativo'
      })
    }

    // 3. Verificar disponibilidade da porta
    const portaDisponivel = await PortasRepository.verificarDisponibilidade(porta_uid, condominio_uid)
    if (!portaDisponivel) {
      return res.status(409).json({
        sucesso: false,
        mensagem: `Porta indisponível. Status atual: ${porta.status_atual}`
      })
    }

    // 4. Buscar gaveteiro para obter IP do ESP32
    const gaveteiro = await GaveteirosRepository.buscarPorUid(porta.gaveteiro_uid)
    
    if (!gaveteiro) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Gaveteiro não encontrado'
      })
    }

    // Verificar se gaveteiro está ativo
    if (!gaveteiro.ativo) {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Gaveteiro inativo'
      })
    }

    // Verificar se o ESP32 tem IP configurado
    if (!gaveteiro.esp32_ip) {
      return res.status(500).json({
        sucesso: false,
        mensagem: 'ESP32 sem IP configurado para este gaveteiro'
      })
    }

    const espIP = gaveteiro.esp32_ip
    const espToken = gaveteiro.esp32_token || process.env.AIRE_ESP_SECRET

    // 5. Enviar comando para o ESP32
    const secret = espToken || process.env.AIRE_ESP_SECRET
    if (!secret) {
      console.error('[API] Token ESP não configurado')
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro de configuração do servidor'
      })
    }

    console.log(`[API] Enviando comando para ESP ${espIP} abrir porta ${porta.numero_porta}`)
    
    const resultadoESP = await ESPService.abrirPorta(
      espIP,
      porta_uid,
      porta.numero_porta,
      secret
    )

    if (!resultadoESP.sucesso) {
      console.error(`[API] Falha ao comunicar com ESP: ${resultadoESP.erro}`)
      
      // Se falhar a comunicação, não atualizamos o banco
      return res.status(503).json({
        sucesso: false,
        mensagem: `Falha ao comunicar com o dispositivo: ${resultadoESP.erro}`
      })
    }

    // 6. Registrar abertura no banco (apenas após sucesso do ESP)
    const registroBemSucedido = await PortasRepository.registrarAbertura(
      porta_uid, 
      condominio_uid, 
      cliente_uid, 
      bloco, 
      apartamento
    )
    
    if (!registroBemSucedido) {
      console.error('[API] ESP abriu a porta, mas falhou ao registrar no banco')
      // A porta foi aberta fisicamente, mas não conseguimos registrar
      // Isso precisa de atenção manual, mas retornamos sucesso para o usuário
    }

    // 7. Log da operação (TODO: Implementar sistema de logs)
    console.log(`[API] Porta ${porta.numero_porta} (UID: ${porta_uid}) aberta com sucesso`)
    // await LogsService.registrarAbertura(porta_uid, usuario_uid, espIP)

    const abertoEm = new Date().toISOString()

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Porta aberta com sucesso',
      dados: {
        porta_uid,
        numero_porta: porta.numero_porta,
        aberto_em: abertoEm
      }
    })

  } catch (error) {
    console.error('[API] Erro ao processar abertura de porta:', error)
    
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno do servidor'
    })
  }
}
