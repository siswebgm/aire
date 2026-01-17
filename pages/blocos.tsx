import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Building2, Home, Loader2, Search, Users, X } from 'lucide-react'
import { MainLayout } from '../components/MainLayout'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../src/contexts/AuthContext'
import type { Apartamento, Bloco, Morador } from '../src/types/gaveteiro'
import { listarApartamentos, listarBlocos, listarMoradores } from '../src/services/gaveteiroService'

export default function BlocosPage() {
  const { condominio } = useAuth()
  const router = useRouter()

  const [mounted, setMounted] = useState(false)

  const [loading, setLoading] = useState(true)
  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [moradores, setMoradores] = useState<Morador[]>([])

  const [blocoSelecionado, setBlocoSelecionado] = useState<string>('ALL')
  const [busca, setBusca] = useState('')

  const [apartamentoSelecionado, setApartamentoSelecionado] = useState<{
    apt: Apartamento
    bloco: Bloco | null
    morador: Morador | undefined
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!condominio?.uid) return
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.uid])

  const carregar = async () => {
    if (!condominio?.uid) return
    setLoading(true)
    try {
      const [blocosData, apartamentosData, moradoresData] = await Promise.all([
        listarBlocos(condominio.uid),
        listarApartamentos(condominio.uid),
        listarMoradores(condominio.uid)
      ])
      setBlocos(blocosData)
      setApartamentos(apartamentosData)
      setMoradores(moradoresData)
    } catch (err) {
      console.error('Erro ao carregar blocos/apartamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  const normalizar = (v: string) => (v || '').trim().toLowerCase()

  const getMoradorDoApartamento = (bloco: Bloco | null, numeroApt: string): Morador | undefined => {
    const aptNorm = normalizar(numeroApt)

    return moradores.find((m) => {
      const morApt = normalizar(m.apartamento || '')
      if (morApt !== aptNorm) return false

      const morBloco = normalizar(m.bloco || '')
      if (!bloco) return !morBloco

      const nomeBloco = normalizar(bloco.nome)
      return morBloco === nomeBloco || nomeBloco.includes(morBloco) || morBloco.includes(nomeBloco)
    })
  }

  const apartamentosPorBloco = useMemo(() => {
    const map = new Map<string | null, Apartamento[]>()
    for (const apt of apartamentos) {
      const key = apt.bloco_uid || null
      const curr = map.get(key) || []
      curr.push(apt)
      map.set(key, curr)
    }

    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
      map.set(key, arr)
    }

    return map
  }, [apartamentos])

  const blocosVisiveis = useMemo(() => {
    if (blocoSelecionado === 'ALL') return blocos
    return blocos.filter((b) => b.uid === blocoSelecionado)
  }, [blocoSelecionado, blocos])

  const matchBloco = (b: Bloco) => {
    const t = normalizar(busca)
    if (!t) return true
    return normalizar(b.nome).includes(t) || normalizar(b.descricao || '').includes(t)
  }

  const matchApartamento = (a: Apartamento, bloco: Bloco | null) => {
    const t = normalizar(busca)
    if (!t) return true

    const morador = getMoradorDoApartamento(bloco, a.numero)

    return (
      normalizar(a.numero).includes(t) ||
      normalizar(a.descricao || '').includes(t) ||
      normalizar(String(a.andar ?? '')).includes(t) ||
      normalizar(bloco?.nome || '').includes(t) ||
      normalizar(morador?.nome || '').includes(t) ||
      normalizar(morador?.whatsapp || '').includes(t) ||
      normalizar(morador?.email || '').includes(t)
    )
  }

  const renderApartamento = (apt: Apartamento, bloco: Bloco | null) => {
    const morador = getMoradorDoApartamento(bloco, apt.numero)
    const temMorador = !!morador

    return (
      <button
        type="button"
        key={apt.uid}
        onClick={() => setApartamentoSelecionado({ apt, bloco, morador })}
        className={`flex items-center justify-center w-12 h-10 rounded border transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300
          ${temMorador ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-rose-600 border-rose-700 text-white'}`}
        title={temMorador ? `Com morador: ${morador?.nome || ''}` : 'Sem morador cadastrado'}
      >
        <span className="font-semibold text-xs">{apt.numero}</span>
      </button>
    )
  }

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

  const aptSemBloco = apartamentosPorBloco.get(null) || []

  return (
    <MainLayout>
      <>
        <Head>
          <title>Blocos - AIRE</title>
          <meta name="description" content="Blocos e apartamentos" />
        </Head>

        <div className="w-full">
          <PageHeader
            title="Blocos"
            subtitle={condominio?.nome || 'Condomínio'}
            sticky={false}
            actions={
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-2 w-full">
                <div className="relative min-w-0">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar bloco, apto ou morador"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                <button
                  onClick={() => router.push('/moradores')}
                  className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white whitespace-nowrap
                           bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md"
                >
                  <Users size={18} />
                  <span className="hidden sm:inline">Ir para moradores</span>
                  <span className="sm:hidden">Moradores</span>
                </button>
              </div>
            }
          />

          <div className="w-full py-4 sm:py-6 space-y-4">
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 md:items-end">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selecionar bloco</label>
                  <select
                    value={blocoSelecionado}
                    onChange={(e) => setBlocoSelecionado(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium bg-white
                             focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-sm hover:border-gray-300"
                  >
                    <option value="ALL">Todos os blocos</option>
                    {blocos.map((b) => (
                      <option key={b.uid} value={b.uid}>
                        {b.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:justify-self-end">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Legenda</label>
                  <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-600 inline-block" />
                      <span className="text-slate-700 font-medium whitespace-nowrap">Com morador</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-3.5 h-3.5 rounded bg-rose-600 inline-block" />
                      <span className="text-slate-700 font-medium whitespace-nowrap">Sem morador</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <Loader2 size={32} className="animate-spin mx-auto text-sky-600" />
                <p className="mt-2 text-slate-500">Carregando...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {blocosVisiveis.filter(matchBloco).map((bloco) => {
                  const aptsDoBloco = (apartamentosPorBloco.get(bloco.uid) || []).filter((a) => matchApartamento(a, bloco))
                  const aptsComMorador = aptsDoBloco.filter((a) => getMoradorDoApartamento(bloco, a.numero)).length

                  return (
                    <div key={bloco.uid} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0">
                            <Building2 size={18} className="text-sky-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-extrabold text-slate-900 truncate">{bloco.nome}</p>
                            <p className="text-sm text-slate-500">
                              {aptsDoBloco.length} apartamento(s)
                              {' · '}
                              <span className="text-emerald-700 font-semibold">{aptsComMorador} com morador</span>
                              {' · '}
                              <span className="text-rose-700 font-semibold">{aptsDoBloco.length - aptsComMorador} sem morador</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50">
                        {aptsDoBloco.length === 0 ? (
                          <p className="text-center text-slate-400 py-6">Nenhum apartamento para exibir</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">{aptsDoBloco.map((apt) => renderApartamento(apt, bloco))}</div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {aptSemBloco.length > 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                        <Home size={18} className="text-slate-700" />
                      </div>
                      <div>
                        <p className="text-base font-extrabold text-slate-900">Sem bloco</p>
                        <p className="text-sm text-slate-500">{aptSemBloco.length} apartamento(s)</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50">
                      <div className="flex flex-wrap gap-1">
                        {aptSemBloco.filter((a) => matchApartamento(a, null)).map((apt) => renderApartamento(apt, null))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {blocos.length === 0 && aptSemBloco.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <Building2 size={40} className="mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-500">Nenhum bloco/apartamento cadastrado</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {mounted && apartamentoSelecionado
          ? createPortal(
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                  onClick={() => setApartamentoSelecionado(null)}
                />

                <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                  <div
                    className={`flex items-start justify-between gap-3 p-5
                    ${apartamentoSelecionado.morador ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}
                  >
                    <div className="min-w-0">
                      <p className="text-base font-extrabold truncate">
                        Apartamento {apartamentoSelecionado.apt.numero}
                        {apartamentoSelecionado.bloco ? ` · ${apartamentoSelecionado.bloco.nome}` : ''}
                      </p>
                      <p className="mt-0.5 text-sm opacity-90">
                        {apartamentoSelecionado.morador ? 'Com morador cadastrado' : 'Sem morador cadastrado'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setApartamentoSelecionado(null)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20"
                      aria-label="Fechar"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="p-5">
                    {apartamentoSelecionado.morador ? (
                      <div className="space-y-1">
                        <p className="text-sm text-slate-500">Morador</p>
                        <p className="text-base font-extrabold text-slate-900">{apartamentoSelecionado.morador.nome}</p>
                        {apartamentoSelecionado.morador.whatsapp ? (
                          <p className="text-sm text-slate-700">WhatsApp: {apartamentoSelecionado.morador.whatsapp}</p>
                        ) : null}
                        {apartamentoSelecionado.morador.email ? (
                          <p className="text-sm text-slate-700">E-mail: {apartamentoSelecionado.morador.email}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-700">
                        Cadastre um morador em <span className="font-semibold">Moradores</span> para este apartamento.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 bg-slate-50/60">
                    {!apartamentoSelecionado.morador && apartamentoSelecionado.bloco ? (
                      <button
                        type="button"
                        onClick={() => {
                          const blocoUid = apartamentoSelecionado.bloco?.uid
                          const apt = apartamentoSelecionado.apt?.numero
                          setApartamentoSelecionado(null)
                          if (!blocoUid || !apt) return
                          void router.push(
                            `/moradores/novo?blocoUid=${encodeURIComponent(blocoUid)}&apartamento=${encodeURIComponent(apt)}`
                          )
                        }}
                        className="px-4 py-2.5 rounded-xl font-semibold text-white
                                 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-md"
                      >
                        Cadastrar morador
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setApartamentoSelecionado(null)}
                      className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}
      </>
    </MainLayout>
  )
}
