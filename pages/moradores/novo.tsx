import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  Building2,
  Home,
  Loader2,
  Mail,
  Plus,
  Save,
  Trash2,
  Users,
  Phone,
  UserPlus
} from 'lucide-react'
import { useAuth } from '../../src/contexts/AuthContext'
import type { Apartamento, Bloco, ContatoAdicional, TipoMorador } from '../../src/types/gaveteiro'
import { criarMorador, listarApartamentos, listarBlocos } from '../../src/services/gaveteiroService'
import { MainLayout } from '../../components/MainLayout'
import { PageHeader } from '../../components/PageHeader'

const onlyDigits = (value: string) => value.replace(/\D/g, '')

function formatNomePtBr(value: string) {
  const ignorarMinusculo = new Set(['de', 'da', 'do', 'dos', 'das'])
  const limpo = (value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  if (!limpo) return ''

  return limpo
    .split(' ')
    .map((p, idx) => {
      if (idx !== 0 && ignorarMinusculo.has(p)) return p
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')
}

function formatWhatsAppBr(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 3) return `(${d.slice(0, 2)})${d.slice(2)}`
  if (d.length <= 7) return `(${d.slice(0, 2)})${d.slice(2, 3)} ${d.slice(3)}`
  return `(${d.slice(0, 2)})${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}

export default function NovoMoradorPage() {
  const { condominio } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])

  const [blocoUid, setBlocoUid] = useState<string>('')
  const [apartamentoNumero, setApartamentoNumero] = useState<string>('')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [tipo, setTipo] = useState<TipoMorador>('PROPRIETARIO')
  const [contatosAdicionais, setContatosAdicionais] = useState<ContatoAdicional[]>([])

  useEffect(() => {
    if (!condominio?.uid) return
    void carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.uid])

  const carregarDados = async () => {
    if (!condominio?.uid) return
    setLoading(true)
    setError('')

    try {
      const [blocosData, apartamentosData] = await Promise.all([
        listarBlocos(condominio.uid),
        listarApartamentos(condominio.uid)
      ])

      setBlocos(blocosData)
      setApartamentos(apartamentosData)
    } catch (err) {
      console.error('Erro ao carregar blocos/apartamentos:', err)
      setError('Erro ao carregar blocos e apartamentos')
    } finally {
      setLoading(false)
    }
  }

  const blocoSelecionado = useMemo(() => {
    if (!blocoUid) return null
    return blocos.find((b) => b.uid === blocoUid) || null
  }, [blocos, blocoUid])

  const apartamentosFiltrados = useMemo(() => {
    if (!blocoUid) {
      return apartamentos
        .filter((a) => !a.bloco_uid)
        .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
    }

    return apartamentos
      .filter((a) => a.bloco_uid === blocoUid)
      .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
  }, [apartamentos, blocoUid])

  const salvar = async () => {
    if (!condominio?.uid) return

    setError('')

    if (!nome.trim()) {
      setError('Nome é obrigatório')
      return
    }

    if (!apartamentoNumero.trim()) {
      setError('Apartamento é obrigatório')
      return
    }

    const contatos = (contatosAdicionais || [])
      .map((c) => ({
        nome: String(c?.nome || '').trim(),
        whatsapp: onlyDigits(String(c?.whatsapp || '')).trim(),
        email: String((c as any)?.email || '')
          .trim()
          .toLowerCase()
      }))
      .filter((c) => c.nome || c.whatsapp || c.email)

    const invalid = contatos.some((c) => {
      const temContato = !!(c.whatsapp || c.email)
      const temNome = !!c.nome
      return (temContato && !temNome) || (temNome && !temContato)
    })
    if (invalid) {
      setError('Contatos adicionais: preencha nome e ao menos um contato (WhatsApp ou email)')
      return
    }

    setSaving(true)
    try {
      await criarMorador({
        condominio_uid: condominio.uid,
        nome: formatNomePtBr(nome),
        email: email.trim().toLowerCase() || null,
        whatsapp: onlyDigits(whatsapp).trim() || null,
        bloco: blocoSelecionado?.nome || null,
        apartamento: apartamentoNumero.trim(),
        tipo,
        contatos_adicionais: contatos,
        observacao: null,
        ativo: true
      } as any)

      await router.push('/moradores')
    } catch (err: any) {
      const code = err?.code || err?.status
      if (code === '23505') {
        setError('Já existe um morador cadastrado para este bloco/apartamento')
      } else {
        console.error('Erro ao salvar morador:', err)
        setError('Erro ao salvar morador')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!condominio) {
    return (
      <MainLayout>
        <div className="w-full py-10 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-500">Carregando...</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <>
        <Head>
          <title>Novo Morador - AIRE</title>
          <meta name="description" content="Cadastro de novo morador" />
        </Head>

        <div className="w-full space-y-6">
          <PageHeader
            title="Novo Morador"
            sticky={false}
            actions={
              <button
                onClick={salvar}
                disabled={saving || loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                         bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar
              </button>
            }
          />

          {error && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="glass-card rounded-2xl overflow-hidden mt-6">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Users size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Dados do Morador</h2>
                  <p className="text-sm text-gray-500">Preencha os campos abaixo</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {loading ? (
                <div className="py-10 text-center">
                  <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
                  <p className="mt-2 text-gray-500">Carregando blocos e apartamentos...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
                      <input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        onBlur={() => setNome((v) => formatNomePtBr(v))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Nome completo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onBlur={() => setEmail((v) => (v || '').trim().toLowerCase())}
                          inputMode="email"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="email@dominio.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp</label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(formatWhatsAppBr(e.target.value))}
                          onBlur={() => setWhatsapp((v) => formatWhatsAppBr(v))}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="(00)0 0000-0000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Bloco</label>
                      <div className="relative">
                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          value={blocoUid}
                          onChange={(e) => {
                            setBlocoUid(e.target.value)
                            setApartamentoNumero('')
                          }}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Sem bloco</option>
                          {blocos.map((b) => (
                            <option key={b.uid} value={b.uid}>
                              {b.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Apartamento *</label>
                      <div className="relative">
                        <Home size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          value={apartamentoNumero}
                          onChange={(e) => setApartamentoNumero(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Selecione</option>
                          {apartamentosFiltrados.map((a) => (
                            <option key={a.uid} value={a.numero}>
                              {a.numero}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                      <select
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value as TipoMorador)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="PROPRIETARIO">Proprietário</option>
                        <option value="INQUILINO">Inquilino</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Contatos adicionais</h2>
                <p className="text-sm text-gray-500">Opcional: para notificação (WhatsApp e/ou email)</p>
              </div>
              <button
                type="button"
                onClick={() => setContatosAdicionais((prev) => [...prev, { nome: '', whatsapp: '', email: '' }])}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Adicionar contato
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {contatosAdicionais.length === 0 ? (
                <div className="text-sm text-slate-500 bg-white/70 border border-slate-200 rounded-xl px-4 py-3">
                  Nenhum contato adicional.
                </div>
              ) : (
                contatosAdicionais.map((c, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-sm font-semibold text-slate-800">Contato {idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => setContatosAdicionais((prev) => prev.filter((_, i) => i !== idx))}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 size={16} />
                        Remover
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nome</label>
                        <input
                          value={c.nome}
                          onChange={(e) =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, nome: e.target.value } : item))
                            )
                          }
                          onBlur={() =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, nome: formatNomePtBr(String(item?.nome || '')) } : item
                              )
                            )
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="Ex.: Maria"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp</label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={c.whatsapp}
                            onChange={(e) =>
                              setContatosAdicionais((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, whatsapp: formatWhatsAppBr(e.target.value) } : item
                                )
                              )
                            }
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="(00)0 0000-0000"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={(c as any).email || ''}
                          onChange={(e) =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, email: e.target.value } : item))
                            )
                          }
                          onBlur={() =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, email: String((item as any)?.email || '').trim().toLowerCase() }
                                  : item
                              )
                            )
                          }
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="email@dominio.com"
                          inputMode="email"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    </MainLayout>
  )
}
