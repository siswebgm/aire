import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, Plus, Edit2, Trash2, Phone, Building2, 
  Home, Loader2, Search, Bell
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { Morador } from '../types/gaveteiro'
import { 
  listarMoradores, 
  excluirMorador 
} from '../services/gaveteiroService'

export default function MoradoresPage() {
  const { condominio } = useAuth()
  const navigate = useNavigate()
  
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Carregar moradores
  useEffect(() => {
    if (condominio?.uid) {
      carregarMoradores()
    }
  }, [condominio?.uid])

  const carregarMoradores = async () => {
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

  // Filtrar moradores
  const moradoresFiltrados = moradores.filter(m => {
    const termo = searchTerm.toLowerCase()
    return (
      m.nome.toLowerCase().includes(termo) ||
      m.apartamento.toLowerCase().includes(termo) ||
      (m.bloco?.toLowerCase().includes(termo)) ||
      (m.whatsapp?.includes(termo))
    )
  })

  // Excluir morador
  const handleExcluir = async (morador: Morador) => {
    if (!confirm(`Deseja excluir o morador "${morador.nome}"?`)) return
    
    try {
      await excluirMorador(morador.uid)
      await carregarMoradores()
    } catch (err) {
      console.error('Erro ao excluir:', err)
      alert('Erro ao excluir morador')
    }
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
            <Users size={24} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Moradores</h1>
            <span className="text-sm text-gray-500">({moradores.length})</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Busca */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar morador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full sm:w-64
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Botão novo */}
            <button
              onClick={() => navigate('/moradores/novo')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white 
                       rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus size={18} />
              Novo Morador
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Moradores */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
            <p className="mt-2 text-gray-500">Carregando moradores...</p>
          </div>
        ) : moradoresFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Nenhum morador encontrado' : 'Nenhum morador cadastrado'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="sm:hidden divide-y">
              {moradoresFiltrados.map(morador => (
                <div key={morador.uid} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{morador.nome}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <Building2 size={14} className="flex-shrink-0" />
                        <span>{morador.bloco || '-'}</span>
                        <Home size={14} className="flex-shrink-0" />
                        <span>{morador.apartamento}</span>
                      </div>
                      {morador.whatsapp && (
                        <a 
                          href={`https://wa.me/55${morador.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-green-600 mt-1"
                        >
                          <Phone size={14} />
                          <span>{morador.whatsapp}</span>
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/moradores/${morador.uid}/editar`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleExcluir(morador)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Morador
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Localização
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      WhatsApp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Notificações
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {moradoresFiltrados.map(morador => (
                    <tr key={morador.uid} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{morador.nome}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          {morador.bloco && (
                            <>
                              <Building2 size={14} />
                              <span>{morador.bloco}</span>
                              <span className="mx-1">-</span>
                            </>
                          )}
                          <Home size={14} />
                          <span>{morador.apartamento}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {morador.whatsapp ? (
                          <a 
                            href={`https://wa.me/55${morador.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-green-600 hover:text-green-700"
                          >
                            <Phone size={14} />
                            <span>{morador.whatsapp}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${morador.tipo === 'PROPRIETARIO' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-orange-100 text-orange-700'}`}
                        >
                          {morador.tipo === 'PROPRIETARIO' ? 'Proprietário' : 'Inquilino'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm">
                          <Bell size={14} className="text-gray-400" />
                          <span className="text-gray-600">
                            {(morador.contatos_adicionais?.length || 0) + (morador.whatsapp ? 1 : 0)} contato(s)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/moradores/${morador.uid}/editar`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleExcluir(morador)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

    </div>
  )
}
