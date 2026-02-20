import { useRouter } from 'next/router'
import { useAuth } from '../src/contexts/AuthContext'
import PdvPage from '../src/pages/PdvPage'

export default function PdvRoute() {
  const { usuario } = useAuth()
  const router = useRouter()

  if (!usuario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white/50 font-semibold">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => router.push('/')}
          className="h-10 px-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-full shadow-2xl hover:from-slate-700 hover:to-slate-800 transition-all duration-300 border border-slate-600 flex items-center justify-center font-semibold text-sm"
          title="Voltar ao painel"
        >
          Sair
        </button>
      </div>
      <PdvPage />
    </div>
  )
}
