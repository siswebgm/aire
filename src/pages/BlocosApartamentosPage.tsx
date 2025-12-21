import { useEffect, useState } from 'react'
import { 
  Building2, Home, Plus, Edit2, Trash2, X, Save, 
  Loader2, ChevronDown, ChevronRight, Users, Check
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { Bloco, Apartamento, Morador } from '../types/gaveteiro'
import { 
  listarBlocos, 
  criarBloco, 
  atualizarBloco, 
  excluirBloco,
  listarApartamentos,
  criarApartamento,
  atualizarApartamento,
  excluirApartamento,
  listarMoradores
} from '../services/gaveteiroService'

export default function BlocosApartamentosPage() {
  const { condominio } = useAuth()
  
  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [loading, setLoading] = useState(true)
  
  // Bloco expandido
  const [blocoExpandido, setBlocoExpandido] = useState<string | null>(null)
  
  // Modais
  const [showModalBloco, setShowModalBloco] = useState(false)
  const [showModalApartamento, setShowModalApartamento] = useState(false)
  const [editandoBloco, setEditandoBloco] = useState<Bloco | null>(null)
  const [editandoApartamento, setEditandoApartamento] = useState<Apartamento | null>(null)
  const [blocoParaApartamento, setBlocoParaApartamento] = useState<Bloco | null>(null)
  
  // Forms
  const [formBloco, setFormBloco] = useState({ nome: '', descricao: '' })
  const [formApartamento, setFormApartamento] = useState({ numero: '', andar: '', descricao: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Carregar dados
  useEffect(() => {
    if (condominio?.uid) {
      carregarDados()
    }
  }, [condominio?.uid])

  const carregarDados = async () => {
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
      
      // Expandir primeiro bloco se houver
      if (blocosData.length > 0 && !blocoExpandido) {
        setBlocoExpandido(blocosData[0].uid)
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  // Verificar se apartamento tem morador
  const getMoradorDoApartamento = (bloco: Bloco | null, numeroApt: string): Morador | undefined => {
    return moradores.find(m => {
      // Compara o número do apartamento
      if (m.apartamento !== numeroApt) return false
      
      // Se não tem bloco, verifica se morador também não tem
      if (!bloco) {
        return !m.bloco || m.bloco.trim() === ''
      }
      
      // Compara o bloco (pode ser "Bloco A" ou apenas "A")
      const nomeBloco = bloco.nome.toLowerCase()
      const blocoMorador = (m.bloco || '').toLowerCase()
      
      return blocoMorador === nomeBloco || 
             nomeBloco.includes(blocoMorador) || 
             blocoMorador.includes(nomeBloco)
    })
  }

  // Apartamentos por bloco
  const getApartamentosPorBloco = (blocoUid: string | null) => {
    return apartamentos
      .filter(a => a.bloco_uid === blocoUid)
      .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
  }

  // Apartamentos sem bloco
  const apartamentosSemBloco = apartamentos
    .filter(a => !a.bloco_uid)
    .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))

  // === BLOCOS ===
  const abrirNovoBloco = () => {
    setEditandoBloco(null)
    setFormBloco({ nome: '', descricao: '' })
    setError('')
    setShowModalBloco(true)
  }

  const abrirEditarBloco = (bloco: Bloco) => {
    setEditandoBloco(bloco)
    setFormBloco({ nome: bloco.nome, descricao: bloco.descricao || '' })
    setError('')
    setShowModalBloco(true)
  }

  const salvarBloco = async () => {
    if (!condominio?.uid) return
    if (!formBloco.nome.trim()) {
      setError('Nome do bloco é obrigatório')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editandoBloco) {
        await atualizarBloco(editandoBloco.uid, {
          nome: formBloco.nome.trim(),
          descricao: formBloco.descricao.trim() || null
        })
      } else {
        await criarBloco({
          condominio_uid: condominio.uid,
          nome: formBloco.nome.trim(),
          descricao: formBloco.descricao.trim() || null,
          ativo: true
        } as any)
      }
      await carregarDados()
      setShowModalBloco(false)
    } catch (err: any) {
      if (err.code === '23505') {
        setError('Já existe um bloco com este nome')
      } else {
        setError('Erro ao salvar bloco')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleExcluirBloco = async (bloco: Bloco) => {
    if (!confirm(`Excluir "${bloco.nome}"? Os apartamentos serão mantidos sem bloco.`)) return
    try {
      await excluirBloco(bloco.uid)
      await carregarDados()
    } catch (err) {
      alert('Erro ao excluir bloco')
    }
  }

  // === APARTAMENTOS ===
  const abrirNovoApartamento = (bloco: Bloco | null) => {
    setEditandoApartamento(null)
    setBlocoParaApartamento(bloco)
    setFormApartamento({ numero: '', andar: '', descricao: '' })
    setError('')
    setShowModalApartamento(true)
  }

  const abrirEditarApartamento = (apt: Apartamento, bloco: Bloco | null) => {
    setEditandoApartamento(apt)
    setBlocoParaApartamento(bloco)
    setFormApartamento({ 
      numero: apt.numero, 
      andar: apt.andar?.toString() || '', 
      descricao: apt.descricao || '' 
    })
    setError('')
    setShowModalApartamento(true)
  }

  const salvarApartamento = async () => {
    if (!condominio?.uid) return
    if (!formApartamento.numero.trim()) {
      setError('Número do apartamento é obrigatório')
      return
    }

    setSaving(true)
    setError('')

    try {
      const dados = {
        condominio_uid: condominio.uid,
        bloco_uid: blocoParaApartamento?.uid || null,
        numero: formApartamento.numero.trim(),
        andar: formApartamento.andar ? parseInt(formApartamento.andar) : null,
        descricao: formApartamento.descricao.trim() || null,
        ativo: true
      }

      if (editandoApartamento) {
        await atualizarApartamento(editandoApartamento.uid, dados)
      } else {
        await criarApartamento(dados as any)
      }
      await carregarDados()
      setShowModalApartamento(false)
    } catch (err: any) {
      if (err.code === '23505') {
        setError('Já existe um apartamento com este número neste bloco')
      } else {
        setError('Erro ao salvar apartamento')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleExcluirApartamento = async (apt: Apartamento) => {
    if (!confirm(`Excluir apartamento "${apt.numero}"?`)) return
    try {
      await excluirApartamento(apt.uid)
      await carregarDados()
    } catch (err) {
      alert('Erro ao excluir apartamento')
    }
  }

  // Estado para modal de detalhes
  const [apartamentoSelecionado, setApartamentoSelecionado] = useState<{apt: Apartamento, bloco: Bloco | null, morador: Morador | undefined} | null>(null)

  // Renderizar card de apartamento - SIMPLIFICADO
  const renderApartamento = (apt: Apartamento, bloco: Bloco | null) => {
    const morador = getMoradorDoApartamento(bloco, apt.numero)
    const temMorador = !!morador

    return (
      <div
        key={apt.uid}
        onClick={() => setApartamentoSelecionado({ apt, bloco, morador })}
        className={`flex items-center justify-center w-12 h-10 rounded border 
                   transition-all cursor-pointer hover:scale-110 hover:shadow-md hover:z-10
          ${temMorador 
            ? 'bg-green-500 border-green-600 text-white' 
            : 'bg-red-500 border-red-600 text-white'}`}
      >
        <span className="font-semibold text-xs">{apt.numero}</span>
      </div>
    )
  }

  if (!condominio) {
    return <div className="text-center py-12 text-gray-500">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 size={24} className="text-purple-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Blocos e Apartamentos</h1>
              <p className="text-sm text-gray-500">
                {blocos.length} bloco(s) • {apartamentos.length} apartamento(s)
              </p>
            </div>
          </div>

          <button
            onClick={abrirNovoBloco}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white 
                     rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <Plus size={18} />
            Novo Bloco
          </button>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-green-500"></div>
            <span className="text-gray-600">Com morador</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-500"></div>
            <span className="text-gray-600">Sem morador</span>
          </div>
        </div>
      </div>

      {/* Grid de Blocos */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-purple-600" />
          <p className="mt-2 text-gray-500">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Seletor de Blocos */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Selecionar Bloco
                </label>
                <div className="relative">
                  <select
                    value={blocoExpandido || ''}
                    onChange={(e) => setBlocoExpandido(e.target.value || null)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium bg-white
                             focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all
                             shadow-sm hover:border-gray-300"
                  >
                    <option value="">Selecione um bloco</option>
                    <option value="ALL">Todos os blocos</option>
                    {blocos.map(bloco => (
                      <option key={bloco.uid} value={bloco.uid}>
                        {bloco.nome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Painel do(s) Bloco(s) Selecionado(s) */}
          {blocoExpandido && (
            <>
              {(blocoExpandido === 'ALL' ? blocos : blocos.filter(b => b.uid === blocoExpandido)).map((bloco) => {
                const aptsDoBloco = getApartamentosPorBloco(bloco.uid)
                const aptsComMorador = aptsDoBloco.filter(a => getMoradorDoApartamento(bloco, a.numero)).length

                return (
                  <div key={bloco.uid} className="bg-purple-50 rounded-lg shadow-lg border-2 border-purple-300">
                    <div className="flex items-center justify-between p-4 bg-purple-50 border-b border-purple-200">
                      <div className="flex items-center gap-3">
                        <Building2 size={24} className="text-purple-600" />
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">{bloco.nome}</h3>
                          <p className="text-sm text-gray-600">
                            {aptsDoBloco.length} apartamento(s) •
                            <span className="text-green-600 font-medium"> {aptsComMorador} com morador</span> •
                            <span className="text-red-600 font-medium"> {aptsDoBloco.length - aptsComMorador} sem morador</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {blocoExpandido !== 'ALL' && (
                          <button
                            onClick={() => setBlocoExpandido(null)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg ml-2"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      {aptsDoBloco.length === 0 ? (
                        <p className="text-center text-gray-400 py-4">
                          Nenhum apartamento cadastrado
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {aptsDoBloco.map(apt => renderApartamento(apt, bloco))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Apartamentos sem bloco */}
          {apartamentosSemBloco.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Home size={20} className="text-gray-400" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Sem Bloco</h3>
                      <p className="text-sm text-gray-500">
                        {apartamentosSemBloco.length} unidade(s)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => abrirNovoApartamento(null)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    title="Adicionar unidade"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-gray-50">
                <div className="flex flex-wrap gap-1">
                  {apartamentosSemBloco.map(apt => renderApartamento(apt, null))}
                </div>
              </div>
            </div>
          )}

          {blocos.length === 0 && apartamentosSemBloco.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhum bloco cadastrado</p>
              <button
                onClick={abrirNovoBloco}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Criar primeiro bloco
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Bloco */}
      {showModalBloco && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">
                {editandoBloco ? 'Editar Bloco' : 'Novo Bloco'}
              </h2>
              <button onClick={() => setShowModalBloco(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formBloco.nome}
                  onChange={e => setFormBloco({ ...formBloco, nome: e.target.value })}
                  placeholder="Ex: Bloco A, Torre 1..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={formBloco.descricao}
                  onChange={e => setFormBloco({ ...formBloco, descricao: e.target.value })}
                  placeholder="Descrição opcional"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => setShowModalBloco(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={salvarBloco}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Apartamento */}
      {showModalApartamento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">
                {editandoApartamento ? 'Editar Apartamento' : 'Novo Apartamento'}
                {blocoParaApartamento && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    - {blocoParaApartamento.nome}
                  </span>
                )}
              </h2>
              <button onClick={() => setShowModalApartamento(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                  <input
                    type="text"
                    value={formApartamento.numero}
                    onChange={e => setFormApartamento({ ...formApartamento, numero: e.target.value })}
                    placeholder="101, 202..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Andar</label>
                  <input
                    type="number"
                    value={formApartamento.andar}
                    onChange={e => setFormApartamento({ ...formApartamento, andar: e.target.value })}
                    placeholder="1, 2, 3..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={formApartamento.descricao}
                  onChange={e => setFormApartamento({ ...formApartamento, descricao: e.target.value })}
                  placeholder="Descrição opcional"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => setShowModalApartamento(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={salvarApartamento}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Apartamento */}
      {apartamentoSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className={`flex items-center justify-between p-4 rounded-t-xl
              ${apartamentoSelecionado.morador ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              <div className="flex items-center gap-3">
                <Home size={24} />
                <div>
                  <h2 className="text-xl font-bold">
                    Apartamento {apartamentoSelecionado.apt.numero}
                  </h2>
                  {apartamentoSelecionado.bloco && (
                    <p className="text-sm opacity-90">{apartamentoSelecionado.bloco.nome}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setApartamentoSelecionado(null)} 
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {apartamentoSelecionado.morador ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                      <Users size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-green-800 text-lg">
                        {apartamentoSelecionado.morador.nome}
                      </p>
                      <p className="text-sm text-green-600">
                        {apartamentoSelecionado.morador.tipo === 'PROPRIETARIO' ? 'Proprietário' : 'Inquilino'}
                      </p>
                    </div>
                  </div>

                  {apartamentoSelecionado.morador.whatsapp && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <span className="font-medium">WhatsApp:</span>
                      <a 
                        href={`https://wa.me/55${apartamentoSelecionado.morador.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        {apartamentoSelecionado.morador.whatsapp}
                      </a>
                    </div>
                  )}

                  {apartamentoSelecionado.morador.contatos_adicionais?.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-700 mb-2">Contatos para notificação:</p>
                      <div className="space-y-2">
                        {apartamentoSelecionado.morador.contatos_adicionais.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                            <span>{c.nome}</span>
                            <span className="text-gray-400">-</span>
                            <span className="text-gray-600">{c.whatsapp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <X size={32} className="text-red-500" />
                  </div>
                  <p className="text-lg font-medium text-red-600">Sem morador cadastrado</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Cadastre um morador na página "Moradores" para este apartamento
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setApartamentoSelecionado(null)
                    abrirEditarApartamento(apartamentoSelecionado.apt, apartamentoSelecionado.bloco)
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm"
                >
                  <Edit2 size={16} />
                  Editar
                </button>
                <button
                  onClick={() => {
                    setApartamentoSelecionado(null)
                    handleExcluirApartamento(apartamentoSelecionado.apt)
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                >
                  <Trash2 size={16} />
                  Excluir
                </button>
              </div>
              <button 
                onClick={() => setApartamentoSelecionado(null)} 
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
