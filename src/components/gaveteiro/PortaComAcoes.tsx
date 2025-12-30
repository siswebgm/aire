import { DoorOpen, Lock, Unlock, Trash2 } from 'lucide-react'
import type { Porta } from '../../types/gaveteiro'

interface PortaComAcoesProps {
  porta: Porta
  onAbrir?: (porta: Porta) => void
  onLiberar?: (porta: Porta) => void
  onCancelar?: (porta: Porta) => void
}

export default function PortaComAcoes({ porta, onAbrir, onLiberar, onCancelar }: PortaComAcoesProps) {
  const disponivel = porta.status_atual === 'DISPONIVEL'
  const ocupado = porta.status_atual === 'OCUPADO'

  return (
    <div className="relative group">
      <button
        className={`aspect-square rounded-lg text-sm font-bold transition-all duration-200 ${
          disponivel 
            ? 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg hover:scale-105 cursor-pointer' 
            : ocupado 
              ? 'bg-red-500 hover:bg-red-600 text-white hover:shadow-lg hover:scale-105 cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        onClick={() => {
          if (disponivel && onAbrir) {
            onAbrir(porta)
          } else if (ocupado && (onLiberar || onCancelar)) {
            // Menu de ações para portas ocupadas
          }
        }}
      >
        {porta.numero_porta}
      </button>

      {/* Menu de ações para portas ocupadas */}
      {ocupado && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto z-10">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onLiberar?.(porta)
              }}
              className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
              title="Liberar com senha"
            >
              <Unlock size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancelar?.(porta)
              }}
              className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
              title="Cancelar ocupação"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Indicadores */}
      {porta.compartilhada && (
        <div className="absolute top-1 right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white"></div>
      )}
      {(porta.bloco_atual || porta.apartamento_atual) && (
        <div className="absolute top-1 left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
      )}
    </div>
  )
}
