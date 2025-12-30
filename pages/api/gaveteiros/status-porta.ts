import { NextApiRequest, NextApiResponse } from 'next'
import { PortasRepository } from '../../../src/repositories/portas.repository'

interface StatusPortaResponse {
  sucesso: boolean
  mensagem: string
  dados?: {
    porta_uid: string
    numero_porta: number
    status_atual: 'DISPONIVEL' | 'OCUPADO' | 'MANUTENCAO'
    fechadura_status: 'aberta' | 'fechada'
    sensor_status: 'desconhecido' | 'aberto' | 'fechado'
    sensor_ima_status: 'desconhecido' | 'aberto' | 'fechado'
    ocupado_em?: string
    finalizado_em?: string
    ultimo_evento_em: string
    cliente_uid?: string
    bloco_atual?: string
    apartamento_atual?: string
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusPortaResponse>
) {
  // Apenas GET permitido
  if (req.method !== 'GET') {
    return res.status(405).json({
      sucesso: false,
      mensagem: 'Método não permitido'
    })
  }

  try {
    const { porta_uid, condominio_uid } = req.query

    // Validação
    if (!porta_uid || !condominio_uid || typeof porta_uid !== 'string' || typeof condominio_uid !== 'string') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'porta_uid e condominio_uid são obrigatórios e devem ser strings'
      })
    }

    console.log(`[API] Consultando status da porta ${porta_uid} no condomínio ${condominio_uid}`)

    // Buscar porta no banco (com filtro de condomínio)
    const porta = await PortasRepository.buscarPorUid(porta_uid, condominio_uid)
    
    if (!porta) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Porta não encontrada'
      })
    }

    // Retornar status lógico (dados do banco)
    return res.status(200).json({
      sucesso: true,
      mensagem: 'Status consultado com sucesso',
      dados: {
        porta_uid: porta.uid,
        numero_porta: porta.numero_porta,
        status_atual: porta.status_atual,
        fechadura_status: porta.fechadura_status,
        sensor_status: porta.sensor_status,
        sensor_ima_status: porta.sensor_ima_status,
        ocupado_em: porta.ocupado_em,
        finalizado_em: porta.finalizado_em,
        ultimo_evento_em: porta.ultimo_evento_em,
        cliente_uid: porta.cliente_uid,
        bloco_atual: porta.bloco_atual,
        apartamento_atual: porta.apartamento_atual
      }
    })

  } catch (error) {
    console.error('[API] Erro ao consultar status da porta:', error)
    
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno do servidor'
    })
  }
}
