import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { AlertTriangle, MoreVertical, Plus, Printer, Search, Trash2, Phone, Building2, Home, Users, X } from 'lucide-react'
import { useAuth } from '../../src/contexts/AuthContext'
import type { Morador } from '../../src/types/gaveteiro'
import { atualizarMorador, listarMoradores } from '../../src/services/gaveteiroService'
import { MainLayout } from '../../components/MainLayout'
import { PageHeader } from '../../components/PageHeader'

 const normalizeContatosAdicionais = (value: any): Array<{ nome: string; whatsapp: string; email: string }> => {
   if (!value) return []
   try {
     const parsed = typeof value === 'string' ? JSON.parse(value) : value
     const arr = Array.isArray(parsed) ? parsed : [parsed]
     return arr
       .filter(Boolean)
       .map((c: any) => ({
         nome: String(c?.nome ?? ''),
         whatsapp: String(c?.whatsapp ?? ''),
         email: String(c?.email ?? '')
       }))
       .filter((c) => c.nome || c.whatsapp || c.email)
   } catch {
     return []
   }
 }

export default function MoradoresIndexPage() {
  const { condominio } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [busca, setBusca] = useState('')
  const [menuUid, setMenuUid] = useState<string | null>(null)
  const [moradorParaDeletar, setMoradorParaDeletar] = useState<Morador | null>(null)
  const [deletando, setDeletando] = useState(false)

  useEffect(() => {
    if (!condominio?.uid) return
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.uid])

  const carregar = async () => {
    if (!condominio?.uid) return
    setLoading(true)
    try {
      const data = await listarMoradores(condominio.uid)
      setMoradores(data)
    } catch (err) {
      console.error('Erro ao carregar moradores:', err)
    } finally {
      setLoading(false)
    }
  }

  const confirmarDeletarMorador = async () => {
    if (!moradorParaDeletar?.uid) return

    setDeletando(true)
    try {
      await atualizarMorador(moradorParaDeletar.uid, { deletado: true } as any)
      setMoradorParaDeletar(null)
      await carregar()
    } catch (err) {
      console.error('Erro ao deletar morador:', err)
      alert('Erro ao deletar morador')
    } finally {
      setDeletando(false)
    }
  }

  useEffect(() => {
    if (!moradorParaDeletar) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoradorParaDeletar(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moradorParaDeletar])

  const moradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return moradores

    return moradores.filter((m) => {
      const nome = (m.nome || '').toLowerCase()
      const email = (m.email || '').toLowerCase()
      const bloco = (m.bloco || '').toLowerCase()
      const apt = (m.apartamento || '').toLowerCase()
      const whatsapp = (m.whatsapp || '').toLowerCase()

      return (
        nome.includes(termo) ||
        email.includes(termo) ||
        bloco.includes(termo) ||
        apt.includes(termo) ||
        whatsapp.includes(termo)
      )
    })
  }, [busca, moradores])

  if (!condominio) {
    return (
      <MainLayout>
        <div className="w-full py-10 text-center">
          <div className="inline-flex items-center gap-3 text-gray-600">
            <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <span>Carregando...</span>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <>
        <Head>
          <title>Moradores - AIRE</title>
          <meta name="description" content="Listagem de moradores" />
        </Head>

        <div className="w-full">
          <PageHeader
            title="Moradores"
            subtitle={condominio?.nome || 'Condomínio'}
            actions={
              <>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar morador"
                    className="w-full sm:w-[420px] pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                <button
                  onClick={() => router.push('/moradores/novo')}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                           bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md"
                >
                  <Plus size={18} />
                  Novo morador
                </button>
              </>
            }
          />

          {moradorParaDeletar ? (
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                onClick={() => (deletando ? null : setMoradorParaDeletar(null))}
              />

              <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={18} className="text-rose-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-extrabold text-slate-900">Deletar morador</p>
                      <p className="mt-0.5 text-sm text-slate-500">Esta ação irá apenas marcar como deletado.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => (deletando ? null : setMoradorParaDeletar(null))}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600"
                    aria-label="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5">
                  <p className="text-sm text-slate-700">Deseja deletar o morador:</p>
                  <p className="mt-1 text-base font-extrabold text-slate-900 truncate">{moradorParaDeletar.nome}</p>
                </div>

                <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => (deletando ? null : setMoradorParaDeletar(null))}
                    className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60"
                    disabled={deletando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarDeletarMorador}
                    className="px-4 py-2.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-60"
                    disabled={deletando}
                  >
                    {deletando ? 'Deletando...' : 'Deletar'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="w-full py-8">
            {loading ? (
              <div className="w-full">
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/70 px-5 py-4 animate-pulse"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="h-4 w-56 bg-slate-200 rounded" />
                          <div className="mt-2 h-3 w-72 bg-slate-100 rounded" />
                        </div>
                        <div className="h-6 w-24 bg-slate-200 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : moradoresFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
                <Users size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-700 font-semibold">Nenhum morador encontrado</p>
                <p className="text-sm text-gray-500 mt-1">Tente ajustar a busca ou cadastre um novo morador.</p>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50/70 border-b border-slate-200/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-4">Nome</div>
                  <div className="col-span-2">Bloco</div>
                  <div className="col-span-1">Apto</div>
                  <div className="col-span-2">WhatsApp</div>
                  <div className="col-span-2">Contatos adicionais</div>
                  <div className="col-span-1 text-right">Tipo</div>
                </div>

                <div className="divide-y divide-slate-200/70">
                  {moradoresFiltrados.map((m) => {
                    const contatos = normalizeContatosAdicionais((m as any).contatos_adicionais)
                    const whatsappStr = m.whatsapp ? String(m.whatsapp) : ''
                    const contatosPreview = contatos
                      .slice(0, 2)
                      .map((c) => {
                        const partes = [
                          c.whatsapp ? String(c.whatsapp) : '',
                          c.email ? String(c.email) : ''
                        ].filter(Boolean)
                        return `${String(c.nome)}${partes.length ? ` (${partes.join(' • ')})` : ''}`
                      })
                      .join(' • ')

                    return (
                      <div
                        key={m.uid}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/moradores/${m.uid}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            router.push(`/moradores/${m.uid}`)
                          }
                        }}
                        className="px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                          <div className="md:col-span-4 min-w-0">
                            <p className="font-extrabold text-slate-900 truncate">{m.nome}</p>
                            {m.email ? <p className="mt-0.5 text-xs text-slate-500 truncate">{m.email}</p> : null}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 md:hidden">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100">
                                <Building2 size={12} className="text-blue-600" />
                                {m.bloco ? m.bloco : 'Sem bloco'}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
                                <Home size={12} className="text-emerald-600" />
                                {m.apartamento}
                              </span>
                            </div>
                          </div>

                          <div className="hidden md:flex md:col-span-2 items-center text-sm text-slate-700">
                            {m.bloco ? m.bloco : '—'}
                          </div>

                          <div className="hidden md:flex md:col-span-1 items-center text-sm text-slate-700">
                            {m.apartamento}
                          </div>

                          <div className="md:col-span-2">
                            {whatsappStr ? (
                              <a
                                href={`https://wa.me/55${whatsappStr.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
                              >
                                <Phone size={16} />
                                {whatsappStr}
                              </a>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            {contatos.length > 0 ? (
                              <div className="text-sm text-slate-700">
                                <span className="block truncate">{contatosPreview}</span>
                                {contatos.length > 2 ? (
                                  <span className="text-xs text-slate-400">+ {contatos.length - 2} contato(s)</span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </div>

                          <div className="md:col-span-1 md:text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className="inline-flex text-xs font-bold px-2.5 py-1 rounded-lg border"
                                style={{
                                  backgroundColor: m.tipo === 'PROPRIETARIO' ? '#EFF6FF' : '#F5F3FF',
                                  borderColor: m.tipo === 'PROPRIETARIO' ? '#BFDBFE' : '#DDD6FE',
                                  color: m.tipo === 'PROPRIETARIO' ? '#1D4ED8' : '#6D28D9'
                                }}
                              >
                                {m.tipo === 'PROPRIETARIO' ? 'Proprietário' : 'Inquilino'}
                              </span>

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setMenuUid((prev) => (prev === m.uid ? null : m.uid))
                                  }}
                                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                  aria-label="Ações"
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {menuUid === m.uid ? (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setMenuUid(null)
                                      }}
                                    />
                                    <div
                                      className="absolute right-0 mt-2 w-44 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setMenuUid(null)
                                          window.open(`/moradores/${m.uid}?print=1`, '_blank')
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        <Printer size={16} className="text-slate-500" />
                                        Imprimir
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setMenuUid(null)
                                          setMoradorParaDeletar(m)
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                                      >
                                        <Trash2 size={16} className="text-rose-600" />
                                        Deletar
                                      </button>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    </MainLayout>
  )
}
