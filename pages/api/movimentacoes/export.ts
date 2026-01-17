import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '../../../lib/server/supabase'

const csvEscape = (value: any) => {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    condominioUid,
    from,
    to,
    acao,
    origem,
    bloco,
    apartamento,
    numeroPorta,
    compartilhada,
    cancelado,
    busca
  } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  const applyBaseFilters = (q: any) => {
    q = q.eq('condominio_uid', condominioUid)

    if (typeof from === 'string' && from.trim()) {
      q = q.gte('timestamp', from)
    }

    if (typeof to === 'string' && to.trim()) {
      q = q.lte('timestamp', to)
    }

    if (typeof origem === 'string' && origem.trim()) {
      q = q.eq('origem', origem)
    }

    if (typeof bloco === 'string' && bloco.trim()) {
      q = q.ilike('bloco', `%${bloco}%`)
    }

    if (typeof apartamento === 'string' && apartamento.trim()) {
      q = q.ilike('apartamento', `%${apartamento}%`)
    }

    if (typeof numeroPorta === 'string' && numeroPorta.trim()) {
      const n = parseInt(numeroPorta, 10)
      if (!Number.isNaN(n)) {
        q = q.eq('numero_porta', n)
      }
    }

    if (typeof compartilhada === 'string' && compartilhada.trim()) {
      if (compartilhada === 'true' || compartilhada === 'false') {
        q = q.eq('compartilhada', compartilhada === 'true')
      }
    }

    if (typeof cancelado === 'string' && cancelado.trim()) {
      if (cancelado === 'true' || cancelado === 'false') {
        q = q.eq('cancelado', cancelado === 'true')
      }
    }

    if (typeof busca === 'string' && busca.trim()) {
      const termo = busca.trim().replace(/,/g, ' ').split(/\s+/).filter(Boolean).join(' ')
      const like = `%${termo}%`
      q = q.or(
        [
          `observacao.ilike.${like}`,
          `bloco.ilike.${like}`,
          `apartamento.ilike.${like}`,
          `origem.ilike.${like}`,
          `condominio_nome.ilike.${like}`,
          `nome_morador.ilike.${like}`,
          `whatsapp_morador.ilike.${like}`,
          `email_morador.ilike.${like}`
        ].join(',')
      )
    }

    return q
  }

  const applyFullFilters = (q: any) => {
    q = applyBaseFilters(q)

    if (typeof acao === 'string' && acao.trim()) {
      const a = acao.trim()
      const upper = a.toUpperCase()
      if (upper === 'OCUPAR' || upper === 'ENTRADA') {
        q = q.in('acao', ['OCUPAR', 'ocupar', 'ENTRADA', 'entrada', 'ocupado', 'OCUPADO'])
      } else if (upper === 'RETIRADA' || upper === 'SAIDA' || upper === 'SAÍDA') {
        q = q.in('acao', ['RETIRADA', 'retirada', 'SAIDA', 'saida', 'SAÍDA', 'saída'])
      } else if (upper === 'CANCELAR' || upper === 'CANCELADO' || upper === 'CANCELADO') {
        q = q.in('acao', ['CANCELAR', 'cancelar', 'CANCELADO', 'cancelado'])
      } else {
        q = q.eq('acao', a)
      }
    }

    return q
  }

  try {
    const q = applyFullFilters(
      supabaseServer
        .from('gvt_movimentacoes_porta')
        .select(
          'uid, timestamp, numero_porta, acao, status_resultante, origem, bloco, apartamento, compartilhada, cancelado, observacao, nome_morador, whatsapp_morador, email_morador, condominio_nome',
          { count: 'exact' }
        )
    )

    const { data, error } = await q.order('timestamp', { ascending: false }).limit(10000)
    if (error) throw error

    const header = [
      'timestamp',
      'numero_porta',
      'acao',
      'status_resultante',
      'origem',
      'bloco',
      'apartamento',
      'compartilhada',
      'cancelado',
      'nome_morador',
      'whatsapp_morador',
      'email_morador',
      'observacao'
    ]

    const rows = (data || []).map((m: any) =>
      [
        csvEscape(m.timestamp),
        csvEscape(m.numero_porta),
        csvEscape(m.acao),
        csvEscape(m.status_resultante),
        csvEscape(m.origem),
        csvEscape(m.bloco),
        csvEscape(m.apartamento),
        csvEscape(m.compartilhada),
        csvEscape(m.cancelado),
        csvEscape(m.nome_morador),
        csvEscape(m.whatsapp_morador),
        csvEscape(m.email_morador),
        csvEscape(m.observacao)
      ].join(',')
    )

    const csv = [header.join(','), ...rows].join('\n')
    const fileName = `movimentos_${new Date().toISOString().slice(0, 10)}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

    return res.status(200).send(csv)
  } catch (error: any) {
    console.error('Erro ao exportar movimentações:', error)
    return res.status(500).json({
      error: 'Erro ao exportar movimentações',
      details: error?.message || String(error)
    })
  }
}
