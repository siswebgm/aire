import { useState, useEffect } from 'react'
import { DoorOpen, LogIn, LogOut, Clock, Calendar, Filter, Search, X } from 'lucide-react'
import type { Porta } from '../../types/gaveteiro'
import { listarTodasPortas } from '../../services/gaveteiroService'
import { useAuth } from '../../contexts/AuthContext'

interface MovimentoPorta {
  porta: Porta
  tipo: 'entrada' | 'saida'
  data: Date
  horario: string
  bloco?: string
  apartamento?: string
}

export default function PainelMovimentos() {
  const { condominio } = useAuth()
  const [movimentos, setMovimentos] = useState<MovimentoPorta[]>([])
  const [movimentosFiltrados, setMovimentosFiltrados] = useState<MovimentoPorta[]>([])
  const [loading, setLoading] = useState(true)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mostrarFiltrosData, setMostrarFiltrosData] = useState(false)

  useEffect(() => {
    carregarMovimentos()
  }, [condominio?.uid])

  useEffect(() => {
    filtrarMovimentos()
  }, [movimentos, dataInicio, dataFim])

  const carregarMovimentos = async () => {
    if (!condominio?.uid) return

    setLoading(true)
    try {
      const todasPortas = await listarTodasPortas(condominio.uid)
      const movimentosPortas: MovimentoPorta[] = []

      todasPortas.forEach(porta => {
        // Entrada (ocupação)
        if (porta.ocupado_em) {
          const dataEntrada = new Date(porta.ocupado_em)
          movimentosPortas.push({
            porta,
            tipo: 'entrada',
            data: dataEntrada,
            horario: dataEntrada.toLocaleString('pt-BR', { 
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit', 
              minute: '2-digit'
            }),
            bloco: porta.bloco_atual,
            apartamento: porta.apartamento_atual
          })
        }

        // Saída (liberação)
        if (porta.finalizado_em) {
          const dataSaida = new Date(porta.finalizado_em)
          movimentosPortas.push({
            porta,
            tipo: 'saida',
            data: dataSaida,
            horario: dataSaida.toLocaleString('pt-BR', { 
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit', 
              minute: '2-digit'
            }),
            bloco: porta.bloco_atual,
            apartamento: porta.apartamento_atual
          })
        }
      })

      // Ordenar por data (mais recente primeiro)
      movimentosPortas.sort((a, b) => b.data.getTime() - a.data.getTime())

      // Remover duplicatas de blocos
      const movimentosUnicos = movimentosPortas.filter((movimento, index, self) => {
        return self.findIndex(m => 
          m.tipo === movimento.tipo && 
          m.data.getTime() === movimento.data.getTime()
        ) === index
      })

      setMovimentos(movimentosUnicos)
    } catch (error) {
      console.error('Erro ao carregar movimentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtrarMovimentos = () => {
    let filtrados = [...movimentos]

    // Filtrar por data
    if (dataInicio) {
      const inicio = new Date(dataInicio)
      inicio.setHours(0, 0, 0, 0)
      filtrados = filtrados.filter(m => m.data >= inicio)
    }

    if (dataFim) {
      const fim = new Date(dataFim)
      fim.setHours(23, 59, 59, 999)
      filtrados = filtrados.filter(m => m.data <= fim)
    }

    setMovimentosFiltrados(filtrados)
  }

  const limparFiltrosData = () => {
    setDataInicio('')
    setDataFim('')
    setMostrarFiltrosData(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Filtros de Data */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <Calendar size={18} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Filtrar por período</h3>
            <p className="text-xs text-gray-500">Selecione as datas para consulta</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarFiltrosData(!mostrarFiltrosData)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 shadow-sm hover:shadow-md ${
              mostrarFiltrosData || dataInicio || dataFim
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              {dataInicio || dataFim ? 'Filtrado' : 'Selecionar período'}
            </div>
          </button>
          {(dataInicio || dataFim) && (
            <button
              onClick={limparFiltrosData}
              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200 border border-red-200"
              title="Limpar filtros"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filtros de Data Expandidos */}
      {mostrarFiltrosData && (
        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 mb-8 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all duration-200 bg-white/80 backdrop-blur-sm"
                placeholder="DD/MM/AAAA"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all duration-200 bg-white/80 backdrop-blur-sm"
                placeholder="DD/MM/AAAA"
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={limparFiltrosData}
              className="px-6 py-2 bg-white/80 backdrop-blur-sm text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-200 text-sm font-medium border border-gray-200 shadow-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm overflow-hidden">
        {movimentosFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum movimento encontrado</h3>
            <p className="text-sm text-gray-500">Tente ajustar as datas ou verifique se há movimentos no período selecionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Data/Hora</th>
                  <th className="px-6 py-4 font-medium">Porta</th>
                  <th className="px-6 py-4 font-medium">Tipo</th>
                  <th className="px-6 py-4 font-medium">Localização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {movimentosFiltrados.map((movimento, index) => (
                  <tr key={`${movimento.porta.uid}-${movimento.tipo}-${index}`} className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-900">{movimento.horario}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm ${
                          movimento.tipo === 'entrada' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-pink-600'
                        }`}>
                          {movimento.porta.numero_porta}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          movimento.tipo === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {movimento.tipo === 'entrada' ? (
                            <LogIn size={16} />
                          ) : (
                            <LogOut size={16} />
                          )}
                        </div>
                        <span className={`text-sm font-semibold ${
                          movimento.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {movimento.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {movimento.bloco && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-700">B</span>
                            </div>
                            <span className="font-medium text-gray-900">{movimento.bloco}</span>
                          </div>
                        )}
                        {movimento.apartamento && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                              <span className="text-xs font-bold text-green-700">A</span>
                            </div>
                            <span className="font-medium text-gray-900">{movimento.apartamento}</span>
                          </div>
                        )}
                        {!movimento.bloco && !movimento.apartamento && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-xs font-bold text-gray-500">?</span>
                            </div>
                            <span className="text-gray-400 text-sm italic">Sem localização</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
