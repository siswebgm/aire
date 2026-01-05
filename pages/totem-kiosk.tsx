import { useRouter } from 'next/router'
import { useAuth } from '../src/contexts/AuthContext'
import GaveteirosTotem from '../src/pages/GaveteirosTotem'
import { useState, useEffect } from 'react'

export default function TotemKioskPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const isNotKiosk = usuario?.perfil !== 'KIOSK'
  const [etapaAtual, setEtapaAtual] = useState('')

  // Observar mudanças na etapa do componente filho
  useEffect(() => {
    // Função para capturar a etapa atual do componente GaveteirosTotem
    const observer = new MutationObserver(() => {
      // Procurar elementos que indicam a etapa atual
      const etapaElement = document.querySelector('[data-etapa]')
      if (etapaElement) {
        setEtapaAtual(etapaElement.getAttribute('data-etapa') || '')
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-etapa']
    })

    return () => observer.disconnect()
  }, [])

  const showHomeButton = isNotKiosk && etapaAtual === 'inicio'

  return (
    <div className="relative">
      {showHomeButton && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => router.push('/')}
            className="h-12 px-5 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-full shadow-2xl hover:from-slate-700 hover:to-slate-800 transition-all duration-300 border border-slate-600 flex items-center justify-center font-semibold"
            title="Sair"
          >
            Sair
          </button>
        </div>
      )}
      <GaveteirosTotem mode="kiosk" />
    </div>
  )
}
