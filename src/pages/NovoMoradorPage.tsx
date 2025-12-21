import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Save, Phone, Building2, Home, UserPlus, Bell, 
  Loader2, AlertCircle, X, Users
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { Apartamento, Bloco, Morador, ContatoAdicional, TipoMorador } from '../types/gaveteiro'
import { 
  listarApartamentos,
  listarBlocos,
  listarMoradores,
  criarMorador, 
  atualizarMorador 
} from '../services/gaveteiroService'

function formatNomePtBr(value: string) {
  const ignorarMinusculo = new Set(['de', 'da', 'do', 'dos', 'das'])
  const limpo = value
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

function onlyDigits(value: string) {
  return value.replace(/\D+/g, '')
}

function formatWhatsAppBr(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const formVazio = {
  nome: '',
  whatsapp: '',
  bloco: '',
  apartamento: '',
  tipo: 'PROPRIETARIO' as TipoMorador,
  contatos_adicionais: [] as ContatoAdicional[],
  observacao: ''
}

export default function NovoMoradorPage() {
  const navigate = useNavigate()
  const { uid } = useParams()
  const { condominio } = useAuth()
  
  const [form, setForm] = useState(formVazio)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!uid)
  const [error, setError] = useState('')

  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [blocoUidSelecionado, setBlocoUidSelecionado] = useState<string>('')
  const [loadingBlocos, setLoadingBlocos] = useState(false)
  const [loadingApartamentos, setLoadingApartamentos] = useState(false)
  
  const isEditing = !!uid

  useEffect(() => {
    if (uid && condominio?.uid) {
      carregarMorador()
    }
  }, [uid, condominio?.uid])

  useEffect(() => {
    if (condominio?.uid) {
      carregarBlocos()
    }
  }, [condominio?.uid])

  useEffect(() => {
    if (!condominio?.uid) return
    carregarApartamentos(blocoUidSelecionado)
    setForm(prev => ({ ...prev, apartamento: '' }))
  }, [condominio?.uid, blocoUidSelecionado])

  const blocoSelecionado = useMemo(() => {
    return blocos.find(b => b.uid === blocoUidSelecionado) || null
  }, [blocos, blocoUidSelecionado])

  const apartamentosDisponiveis = useMemo(() => {
    if (blocoUidSelecionado) {
      return apartamentos
        .filter(a => a.bloco_uid === blocoUidSelecionado)
        .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
    }

    // Sem bloco selecionado: mostrar apenas apartamentos sem bloco
    return apartamentos
      .filter(a => !a.bloco_uid)
      .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
  }, [apartamentos, blocoUidSelecionado])

  const carregarBlocos = async () => {
    if (!condominio?.uid) return
    setLoadingBlocos(true)
    try {
      const data = await listarBlocos(condominio.uid)
      setBlocos(data)
    } catch (err) {
      console.error('Erro ao carregar blocos:', err)
    } finally {
      setLoadingBlocos(false)
    }
  }

  const carregarApartamentos = async (blocoUid: string) => {
    if (!condominio?.uid) return
    setLoadingApartamentos(true)
    try {
      // Se houver bloco selecionado, carrega apenas daquele bloco.
      // Se não houver, carrega todos e filtramos na UI para mostrar apenas sem bloco.
      const data = blocoUid
        ? await listarApartamentos(condominio.uid, blocoUid)
        : await listarApartamentos(condominio.uid)
      setApartamentos(data)
    } catch (err) {
      console.error('Erro ao carregar apartamentos:', err)
    } finally {
      setLoadingApartamentos(false)
    }
  }

  const carregarMorador = async () => {
    if (!condominio?.uid || !uid) return
    setLoading(true)
    try {
      const moradores = await listarMoradores(condominio.uid)
      const morador = moradores.find(m => m.uid === uid)
      if (morador) {
        setForm({
          nome: morador.nome,
          whatsapp: morador.whatsapp || '',
          bloco: morador.bloco || '',
          apartamento: morador.apartamento,
          tipo: morador.tipo,
          contatos_adicionais: morador.contatos_adicionais || [],
          observacao: morador.observacao || ''
        })

        // Tenta sincronizar bloco/apartamento com os dropdowns
        const nomeBloco = (morador.bloco || '').trim().toLowerCase()
        if (nomeBloco) {
          const blocoMatch = blocos.find(b => b.nome.trim().toLowerCase() === nomeBloco)
          if (blocoMatch) {
            setBlocoUidSelecionado(blocoMatch.uid)
          }
        }
      } else {
        setError('Morador não encontrado')
      }
    } catch (err) {
      console.error('Erro ao carregar morador:', err)
      setError('Erro ao carregar dados do morador')
    } finally {
      setLoading(false)
    }
  }

  const salvarMorador = async () => {
    if (!condominio?.uid) return
    
    if (!form.nome.trim()) {
      setError('Nome é obrigatório')
      return
    }
    if (!form.apartamento.trim()) {
      setError('Apartamento é obrigatório')
      return
    }

    setSaving(true)
    setError('')

    try {
      const dadosMorador = {
        condominio_uid: condominio.uid,
        nome: form.nome.trim(),
        whatsapp: onlyDigits(form.whatsapp).trim() || null,
        bloco: blocoUidSelecionado ? (blocoSelecionado?.nome || null) : null,
        apartamento: form.apartamento.trim(),
        tipo: form.tipo,
        contatos_adicionais: form.contatos_adicionais,
        observacao: form.observacao.trim() || null,
        ativo: true
      }

      if (isEditing && uid) {
        await atualizarMorador(uid, dadosMorador)
      } else {
        await criarMorador(dadosMorador as any)
      }

      navigate('/moradores')
    } catch (err: any) {
      console.error('Erro ao salvar:', err)
      if (err.code === '23505') {
        setError('Já existe um morador neste bloco/apartamento')
      } else {
        setError('Erro ao salvar. Tente novamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  const adicionarContato = () => {
    setForm({
      ...form,
      contatos_adicionais: [...form.contatos_adicionais, { nome: '', whatsapp: '' }]
    })
  }

  const atualizarContato = (index: number, campo: 'nome' | 'whatsapp', valor: string) => {
    const novosContatos = [...form.contatos_adicionais]
    novosContatos[index] = { ...novosContatos[index], [campo]: valor }
    setForm({ ...form, contatos_adicionais: novosContatos })
  }

  const removerContato = (index: number) => {
    const novosContatos = form.contatos_adicionais.filter((_, i) => i !== index)
    setForm({ ...form, contatos_adicionais: novosContatos })
  }

  if (!condominio) {
    return <div className="text-center py-12 text-gray-500">Carregando...</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-[1300px] mx-auto">
      <div className="mb-6">
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users size={24} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight tracking-tight" style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}>
                  {isEditing ? 'Editar Morador' : 'Novo Morador'}
                </h1>
                <p className="text-gray-500 text-sm sm:text-[15px] mt-1">
                  {isEditing ? 'Atualize os dados do morador' : 'Preencha os dados para cadastrar um novo morador'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.18em] flex items-center gap-2">
              <Users size={16} className="text-blue-500" />
              Informações Pessoais
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Morador <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  onBlur={() => setForm(prev => ({ ...prev, nome: formatNomePtBr(prev.nome) }))}
                  placeholder="Nome completo"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone size={14} className="inline mr-1" />
                  WhatsApp Principal
                </label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={e => setForm({ ...form, whatsapp: formatWhatsAppBr(e.target.value) })}
                  onBlur={() => setForm(prev => ({ ...prev, whatsapp: formatWhatsAppBr(prev.whatsapp) }))}
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.18em] flex items-center gap-2">
                <Building2 size={16} className="text-blue-500" />
                Localização
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bloco/Torre</label>
                <select
                  value={blocoUidSelecionado}
                  onChange={e => {
                    setBlocoUidSelecionado(e.target.value)
                    setForm(prev => ({ ...prev, bloco: '' }))
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white disabled:opacity-50"
                  disabled={loadingBlocos}
                >
                  <option value="">Sem bloco</option>
                  {blocos.map(bloco => (
                    <option key={bloco.uid} value={bloco.uid}>
                      {bloco.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apartamento <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.apartamento}
                  onChange={e => setForm({ ...form, apartamento: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loadingApartamentos || (blocoUidSelecionado !== '' && apartamentosDisponiveis.length === 0)}
                >
                  <option value="">Selecione o apartamento</option>
                  {apartamentosDisponiveis.map(apto => (
                    <option key={apto.uid} value={apto.numero}>
                      {apto.numero}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Home size={14} className="inline mr-1" />
                Tipo de Morador
              </label>
              <select
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value as TipoMorador })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="PROPRIETARIO">Proprietário</option>
                <option value="INQUILINO">Inquilino</option>
              </select>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between bg-gray-50 rounded-t-xl px-5 pt-4 pb-3 border border-gray-100 border-b-0">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.18em] flex items-center gap-2">
                  <Bell size={16} className="text-blue-500" />
                  Contatos para Notificação
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-snug">
                  Estes contatos serão notificados quando houver mercadoria no gaveteiro
                </p>
              </div>
              <button
                type="button"
                onClick={adicionarContato}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors font-medium shadow-sm"
              >
                <UserPlus size={16} />
                Adicionar
              </button>
            </div>

            {form.contatos_adicionais.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-b-xl border border-dashed border-gray-200 border-t-0">
                <UserPlus size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Nenhum contato adicional</p>
                <p className="text-xs text-gray-400">Clique em "Adicionar" para incluir</p>
              </div>
            ) : (
              <div className="space-y-3 bg-gray-50 rounded-b-xl px-5 pb-5 border border-gray-100 border-t-0">
                {form.contatos_adicionais.map((contato, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={contato.nome}
                        onChange={e => atualizarContato(index, 'nome', e.target.value)}
                        placeholder="Nome do contato"
                        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={contato.whatsapp}
                        onChange={e => atualizarContato(index, 'whatsapp', e.target.value)}
                        placeholder="WhatsApp"
                        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removerContato(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-3 bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.18em]">Observações</h3>
              <textarea
                value={form.observacao}
                onChange={e => setForm({ ...form, observacao: e.target.value })}
                placeholder="Observações sobre o morador (opcional)..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all bg-white"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 border-t">
          <button
            onClick={() => navigate('/moradores')}
            className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={salvarMorador}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 font-medium shadow-lg shadow-blue-500/25"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={18} />
                {isEditing ? 'Atualizar' : 'Cadastrar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
