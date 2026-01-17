import type { NextApiRequest, NextApiResponse } from 'next'
import { buscarCondominio, criarMorador, listarApartamentos, listarBlocos, listarMoradores } from '../../../lib/server/gaveteiroServiceComplete'

const onlyDigits = (value: string) => (value || '').replace(/\D/g, '')
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { condominioUid, nome, email, whatsapp, blocoUid, apartamento, facial_url, contatos_adicionais } = req.body || {}

  if (!condominioUid || typeof condominioUid !== 'string') {
    return res.status(400).json({ error: 'condominioUid é obrigatório' })
  }

  try {
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' })
    }

    const whatsappDigits = onlyDigits(String(whatsapp || '')).trim()
    if (!whatsappDigits || whatsappDigits.length < 10) {
      return res.status(400).json({ error: 'WhatsApp inválido' })
    }

    if (!blocoUid || typeof blocoUid !== 'string') {
      return res.status(400).json({ error: 'Bloco é obrigatório' })
    }

    if (!apartamento || typeof apartamento !== 'string' || !apartamento.trim()) {
      return res.status(400).json({ error: 'Apartamento é obrigatório' })
    }

    const [condominio, blocos, apartamentos, moradores] = await Promise.all([
      buscarCondominio(condominioUid),
      listarBlocos(condominioUid),
      listarApartamentos(condominioUid),
      listarMoradores(condominioUid)
    ])

    if (!condominio) return res.status(404).json({ error: 'Condomínio não encontrado' })

    const bloco = (blocos || []).find((b: any) => b.uid === blocoUid)
    if (!bloco) return res.status(400).json({ error: 'Bloco inválido' })

    const apt = (apartamentos || []).find((a: any) => a.bloco_uid === blocoUid && normalize(a.numero) === normalize(apartamento))
    if (!apt) return res.status(400).json({ error: 'Apartamento inválido' })

    const moradoresAtivos = (moradores || []).filter((m: any) => m?.ativo !== false && m?.deletado !== true)

    const bNorms = blocoCandidates(bloco.nome)
    const aCands = aptCandidates(apartamento)

    const jaExiste = moradoresAtivos.some((m: any) => {
      const mb = blocoCandidates(m.bloco || '')
      const ma = aptCandidates(m.apartamento || '')
      return aCands.some((a) => ma.includes(a)) && bNorms.some((b) => mb.includes(b))
    })

    if (jaExiste) {
      return res.status(409).json({ error: 'Já existe um morador cadastrado para este bloco/apartamento' })
    }

    const contatosBase = Array.isArray(contatos_adicionais) ? contatos_adicionais : []
    const contatosLimpos = contatosBase
      .map((c: any) => {
        const n = typeof c?.nome === 'string' ? c.nome.trim() : ''
        const w = onlyDigits(String(c?.whatsapp || '')).trim()
        const e = typeof c?.email === 'string' ? c.email.trim().toLowerCase() : ''
        const f = typeof c?.facial_url === 'string' ? c.facial_url.trim() : ''
        return { nome: n, whatsapp: w, email: e, facial_url: f }
      })
      .filter((c: any) => c.nome || c.whatsapp || c.email || c.facial_url)

    const invalid = contatosLimpos.some((c: any) => {
      const temContato = !!(c.whatsapp || c.email)
      const temNome = !!c.nome
      return (temContato && !temNome) || (temNome && !temContato)
    })
    if (invalid) {
      return res.status(400).json({ error: 'Contatos adicionais: preencha nome e ao menos um contato (WhatsApp ou email)' })
    }

    const morador = await criarMorador({
      condominio_uid: condominioUid,
      nome: nome.trim(),
      email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null,
      whatsapp: whatsappDigits,
      facial_url: typeof facial_url === 'string' && facial_url.trim() ? facial_url.trim() : null,
      bloco: bloco.nome,
      apartamento: apartamento.trim(),
      tipo: 'PROPRIETARIO',
      contatos_adicionais: contatosLimpos.map((c: any) => ({
        nome: c.nome,
        whatsapp: c.whatsapp || null,
        email: c.email || null,
        facial_url: c.facial_url || null
      })),
      observacao: null,
      ativo: true
    } as any)

    return res.status(201).json({ success: true, morador: { uid: (morador as any).uid } })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Erro ao cadastrar' })
  }
}
