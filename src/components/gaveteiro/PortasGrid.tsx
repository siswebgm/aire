import { useState } from 'react'
import { 
  DoorOpen, 
  DoorClosed, 
  Lock,
  Clock, 
  Check, 
  Unlock, 
  Package,
  Loader2
} from 'lucide-react'
import type { Porta, StatusPorta } from '../../types/gaveteiro'
import { abrirPorta, darBaixaPorta, liberarPorta } from '../../services/gaveteiroService'

interface PortasGridProps {
  portas: Porta[]
  condominioUid: string
  loading?: boolean
  onUpdate: () => void
}

function calcularTempoDecorrido(dataInicio?: string): string {
  if (!dataInicio) return ''
  
  const inicio = new Date(dataInicio)
  const agora = new Date()
  const diffMs = agora.getTime() - inicio.getTime()
  
  const minutos = Math.floor(diffMs / 60000)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)
  
  if (dias > 0) return `${dias}d ${horas % 24}h`
  if (horas > 0) return `${horas}h ${minutos % 60}min`
  return `${minutos}min`
}

function getStatusConfig(status: StatusPorta) {
  switch (status) {
    case 'DISPONIVEL':
      return {
        label: 'Disponível',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-300',
        icon: Lock,
        iconBg: 'bg-green-500'
      }
    case 'OCUPADO':
      return {
        label: 'Ocupado',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-300',
        icon: DoorClosed,
        iconBg: 'bg-red-500'
      }
    case 'AGUARDANDO_RETIRADA':
      return {
        label: 'Aguardando Retirada',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-300',
        icon: Package,
        iconBg: 'bg-yellow-500'
      }
    case 'BAIXADO':
      return {
        label: 'Baixado',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-300',
        icon: Check,
        iconBg: 'bg-gray-500'
      }
  }
}

function PortaCard({
  porta,
  condominioUid,
  onUpdate
}: {
  porta: Porta
  condominioUid: string
  onUpdate: () => void
}) {
  const [loading, setLoading] = useState(false)
  const config = getStatusConfig(porta.status_atual)
  const Icon = config.icon

  const handleAbrir = async () => {
    if (loading) return
    setLoading(true)
    try {
      await abrirPorta(porta.uid, condominioUid)
      onUpdate()
    } catch (err) {
      console.error('Erro ao abrir porta:', err)
      alert('Erro ao abrir porta')
    } finally {
      setLoading(false)
    }
  }

  const handleBaixa = async () => {
    if (loading) return
    setLoading(true)
    try {
      await darBaixaPorta(porta.uid, condominioUid)
      onUpdate()
    } catch (err) {
      console.error('Erro ao dar baixa:', err)
      alert('Erro ao dar baixa')
    } finally {
      setLoading(false)
    }
  }

  const handleLiberar = async () => {
    if (loading) return
    setLoading(true)
    try {
      await liberarPorta(porta.uid, condominioUid)
      onUpdate()
    } catch (err) {
      console.error('Erro ao liberar porta:', err)
      alert('Erro ao liberar porta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`
      relative p-3 sm:p-4 rounded-xl border-2 ${config.borderColor} ${config.bgColor}
      transition-all hover:shadow-lg
    `}>
      {/* Indicador de tamanho no canto superior direito */}
      {porta.tamanho && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <div className={`${config.bgColor} text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg opacity-90`}>
            {porta.tamanho}
          </div>
        </div>
      )}
      
      {/* Número da porta */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className={`
          w-10 h-10 sm:w-12 sm:h-12 rounded-full ${config.iconBg} text-white
          flex items-center justify-center text-lg sm:text-xl font-bold drop-shadow-lg
        `}>
          {porta.numero_porta}
        </div>
        <Icon size={24} className={`${config.textColor} sm:w-7 sm:h-7`} />
      </div>

      {/* Status */}
      <div className={`text-xs sm:text-sm font-semibold ${config.textColor} mb-1`}>
        {config.label}
      </div>

      {/* Tempo */}
      {porta.status_atual === 'OCUPADO' && porta.ocupado_em && (
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-600 mb-2 sm:mb-3">
          <Clock size={10} className="sm:w-3 sm:h-3" />
          <span className="truncate">Há {calcularTempoDecorrido(porta.ocupado_em)}</span>
        </div>
      )}

      {porta.status_atual === 'BAIXADO' && porta.finalizado_em && (
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-600 mb-2 sm:mb-3">
          <Clock size={10} className="sm:w-3 sm:h-3" />
          <span className="truncate">Há {calcularTempoDecorrido(porta.finalizado_em)}</span>
        </div>
      )}

      {/* Ações */}
      <div className="mt-2 sm:mt-3">
        {porta.status_atual === 'DISPONIVEL' && (
          <button
            onClick={handleAbrir}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 
                       bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg 
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
            <span className="hidden xs:inline">Abrir</span>
          </button>
        )}

        {porta.status_atual === 'OCUPADO' && (
          <button
            onClick={handleBaixa}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 
                       bg-orange-600 text-white text-xs sm:text-sm font-medium rounded-lg 
                       hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            <span className="hidden xs:inline">Baixa</span>
          </button>
        )}

        {(porta.status_atual === 'BAIXADO' || porta.status_atual === 'AGUARDANDO_RETIRADA') && (
          <button
            onClick={handleLiberar}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 
                       bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg 
                       hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <DoorOpen size={14} />}
            <span className="hidden xs:inline">Liberar</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function PortasGrid({
  portas,
  condominioUid,
  loading,
  onUpdate
}: PortasGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="p-3 sm:p-4 rounded-xl border border-gray-200 bg-gray-50 animate-pulse">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (portas.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 text-gray-500">
        <DoorClosed size={48} className="mx-auto mb-4 opacity-50 sm:w-16 sm:h-16" />
        <p className="text-base sm:text-lg">Nenhuma porta encontrada</p>
        <p className="text-xs sm:text-sm">Selecione um gaveteiro para ver suas portas</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {portas.map(porta => (
        <PortaCard
          key={porta.uid}
          porta={porta}
          condominioUid={condominioUid}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}
