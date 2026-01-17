import type { NextApiRequest, NextApiResponse } from 'next'
import { buscarCondominio, listarApartamentos, listarBlocos, listarMoradores } from '../../../lib/server/gaveteiroServiceComplete'

const normalize = (v: string) => (v || '').trim().toLowerCase()
const stripLeadingZeros = (v: string) => v.replace(/^0+(?!$)/, '')
const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))

const blocoCandidates = (blocoNome?: string | null) => {
  const b = typeof blocoNome === 'string' ? blocoNome.trim() : ''
  if (!b) return [] as string[]

  const digits = b.match(/\d+/)?.[0] ?? null
  const digitsNoZero = digits ? stripLeadingZeros(digits) : null
  const digits2 = digitsNoZero ? digitsNoZero.padStart(2, '0') : null

  return unique([
    b,
    stripLeadingZeros(b),
    digits ?? '',
    digitsNoZero ?? '',
    digits2 ?? '',
    digits2 ? `Bloco ${digits2}` : '',
    digitsNoZero ? `Bloco ${digitsNoZero}` : ''
  ]).map((x) => normalize(x))
}

const aptCandidates = (apt?: string | null) => {
  const a = typeof apt === 'string' ? apt.trim() : ''
  if (!a) return [] as string[]
  return unique([a, stripLeadingZeros(a)]).map((x) => normalize(x))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const condominioUid = typeof req.query.condominioUid === 'string' ? req.query.condominioUid : ''
  if (!condominioUid) return res.status(400).json({ error: 'condominioUid é obrigatório' })

  try {
    const [condominio, blocos, apartamentos, moradores] = await Promise.all([
      buscarCondominio(condominioUid),
      listarBlocos(condominioUid),
      listarApartamentos(condominioUid),
      listarMoradores(condominioUid)
    ])

    if (!condominio) return res.status(404).json({ error: 'Condomínio não encontrado' })

    const moradoresAtivos = (moradores || []).filter((m: any) => m?.ativo !== false && m?.deletado !== true)

    const moradorSet = new Set<string>()
    for (const m of moradoresAtivos) {
      const bCands = blocoCandidates(m.bloco || '')
      const aCands = aptCandidates(m.apartamento || '')
      for (const b of bCands.length ? bCands : ['']) {
        for (const a of aCands) {
          moradorSet.add(`${b}|${a}`)
        }
      }
    }

    const blocosByUid = new Map<string, any>((blocos || []).map((b: any) => [b.uid, b]))

    const disponiveis: Array<{ blocoUid: string; blocoNome: string; apartamentos: Array<{ uid: string; numero: string }> }> = []

    for (const bloco of blocos || []) {
      const bNorms = blocoCandidates(bloco.nome)
      const apts = (apartamentos || []).filter((a: any) => a.bloco_uid === bloco.uid && a.ativo !== false)

      const livres = apts.filter((a: any) => {
        const aCands = aptCandidates(a.numero)
        return !aCands.some((aptNorm) => bNorms.some((bn) => moradorSet.has(`${bn}|${aptNorm}`)))
      })

      if (livres.length) {
        disponiveis.push({
          blocoUid: bloco.uid,
          blocoNome: bloco.nome,
          apartamentos: livres.map((a: any) => ({ uid: a.uid, numero: a.numero }))
        })
      }
    }

    // opcional: apartamentos sem bloco não entram pois cadastro exige bloco atualmente

    return res.status(200).json({
      condominio: condominio
        ? {
            uid: (condominio as any).uid,
            nome: (condominio as any).nome,
            storage: (condominio as any).storage
          }
        : null,
      blocos: disponiveis
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erro ao buscar dados' })
  }
}
