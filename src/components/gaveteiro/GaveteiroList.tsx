import { useEffect, useState } from 'react'
import { Box, Building2 } from 'lucide-react'
import type { Gaveteiro, ResumoPortas } from '../../types/gaveteiro'
import { obterResumoPortas } from '../../services/gaveteiroService'

interface GaveteiroListProps {
  gaveteiros: Gaveteiro[]
  selectedUid?: string
  onSelect: (gaveteiro: Gaveteiro) => void
  loading?: boolean
}

function GaveteiroCard({
  gaveteiro,
  selected,
  onClick
}: {
  gaveteiro: Gaveteiro
  selected: boolean
  onClick: () => void
}) {
  const [resumo, setResumo] = useState<ResumoPortas | null>(null)

  useEffect(() => {
    obterResumoPortas(gaveteiro.uid)
      .then(setResumo)
      .catch(console.error)
  }, [gaveteiro.uid])

  return (
    <div
      onClick={onClick}
      className={`
        p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all
        ${selected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'
        }
      `}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className={`p-1.5 sm:p-2 rounded-lg ${selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          <Building2 size={20} className="sm:w-6 sm:h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{gaveteiro.nome}</h3>
          <p className="text-xs sm:text-sm text-gray-500 truncate">{gaveteiro.codigo_hardware}</p>
        </div>
      </div>

      {resumo && (
        <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full bg-green-100 text-green-700">
            <Box size={10} className="sm:w-3 sm:h-3" />
            {resumo.disponivel} livres
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full bg-red-100 text-red-700">
            <Box size={10} className="sm:w-3 sm:h-3" />
            {resumo.ocupado} ocupados
          </span>
          {resumo.baixado > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full bg-gray-100 text-gray-700">
              <Box size={10} className="sm:w-3 sm:h-3" />
              {resumo.baixado} baixados
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function GaveteiroList({
  gaveteiros,
  selectedUid,
  onSelect,
  loading
}: GaveteiroListProps) {
  if (loading) {
    return (
      <div className="flex lg:flex-col gap-2 sm:gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-shrink-0 w-48 lg:w-full p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50 animate-pulse">
            <div className="h-5 sm:h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (gaveteiros.length === 0) {
    return (
      <div className="text-center py-6 sm:py-8 text-gray-500">
        <Building2 size={40} className="mx-auto mb-3 opacity-50 sm:w-12 sm:h-12" />
        <p className="text-sm sm:text-base">Nenhum gaveteiro encontrado</p>
      </div>
    )
  }

  return (
    <div className="flex lg:flex-col gap-2 sm:gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-1 px-1">
      {gaveteiros.map(gaveteiro => (
        <div key={gaveteiro.uid} className="flex-shrink-0 w-56 sm:w-64 lg:w-full">
          <GaveteiroCard
            gaveteiro={gaveteiro}
            selected={gaveteiro.uid === selectedUid}
            onClick={() => onSelect(gaveteiro)}
          />
        </div>
      ))}
    </div>
  )
}
