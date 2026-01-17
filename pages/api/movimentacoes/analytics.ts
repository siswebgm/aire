import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '../../../lib/server/supabase'

type AnalyticsItem = {
  key: string
  label: string
  entradas: number
  saidas: number
  canceladas: number
  total: number
}

type AnalyticsResponse = {
  topPortas: AnalyticsItem[]
  topBlocosApartamentos: AnalyticsItem[]
}

const normalize = (v: any) => String(v || '').trim().toLowerCase()

const isCancel = (row: any) => {
  if (row?.cancelado === true) return true
  const acao = normalize(row?.acao)
  return acao === 'cancelado' || acao === 'cancelar' || acao === 'cancelamento'
}

const isEntrada = (row: any) => {
  const tipo = normalize(row?.tipo_acao)
  if (tipo) return tipo === 'entrada'

  const acao = normalize(row?.acao)
  if (acao) return acao === 'ocupar'

  const status = normalize(row?.status_resultante)
  return status === 'ocupado'
}

const isSaida = (row: any) => {
  const tipo = normalize(row?.tipo_acao)
  if (tipo) return tipo === 'saida' || tipo === 'saída'

  const acao = normalize(row?.acao)
  if (acao) return acao === 'retirada' || acao === 'liberar' || acao === 'baixar'

  const status = normalize(row?.status_resultante)
  return status === 'disponivel' || status === 'disponível' || status === 'baixado'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, from, to } = req.query

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    let q: any = supabaseServer
      .from('gvt_movimentacoes_porta')
      .select('uid, acao, tipo_acao, status_resultante, cancelado, numero_porta, bloco, apartamento, timestamp')
      .eq('condominio_uid', condominioUid)

    if (typeof from === 'string' && from.trim()) {
      q = q.gte('timestamp', from)
    }

    if (typeof to === 'string' && to.trim()) {
      q = q.lte('timestamp', to)
    }

    // Analytics: buscar um volume grande (mas com proteção). Se precisar de 100% exato em base muito grande,
    // o ideal é criar uma view/funcão SQL com agregação.
    const { data, error } = await q.order('timestamp', { ascending: false }).limit(10000)

    if (error) throw error

    const portaMap = new Map<string, AnalyticsItem>()
    const blocoAptoMap = new Map<string, AnalyticsItem>()

    const ensure = (map: Map<string, AnalyticsItem>, key: string, label: string) => {
      const existing = map.get(key)
      if (existing) return existing
      const item: AnalyticsItem = { key, label, entradas: 0, saidas: 0, canceladas: 0, total: 0 }
      map.set(key, item)
      return item
    }

    for (const m of data || []) {
      const canceled = isCancel(m)

      const entrada = isEntrada(m)
      const saida = isSaida(m)
      if (!entrada && !saida && !canceled) continue

      const numeroPorta = (m as any)?.numero_porta
      const portaKey = typeof numeroPorta === 'number' ? String(numeroPorta) : '—'
      const portaLabel = typeof numeroPorta === 'number' ? `Porta ${numeroPorta}` : 'Porta —'

      const bloco = String((m as any)?.bloco || '').trim()
      const apto = String((m as any)?.apartamento || '').trim()
      const blocoAptoKey = `${bloco}||${apto}`
      const blocoAptoLabel = bloco || apto ? `${bloco || '—'} · ${apto || '—'}` : '—'

      const p = ensure(portaMap, portaKey, portaLabel)
      const b = ensure(blocoAptoMap, blocoAptoKey, blocoAptoLabel)

      if (entrada) {
        p.entradas += 1
        b.entradas += 1
      }

      if (saida) {
        p.saidas += 1
        b.saidas += 1
      }

      if (canceled) {
        p.canceladas += 1
        b.canceladas += 1
      }

      p.total += 1
      b.total += 1
    }

    const top = (items: AnalyticsItem[], take: number) =>
      items
        .filter((i) => i.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, take)

    const response: AnalyticsResponse = {
      topPortas: top(Array.from(portaMap.values()), 15),
      topBlocosApartamentos: top(Array.from(blocoAptoMap.values()), 15)
    }

    return res.status(200).json(response)
  } catch (error: any) {
    console.error('Erro ao gerar analytics:', error)
    return res.status(500).json({
      error: 'Erro ao gerar analytics',
      details: error?.message || String(error)
    })
  }
}
