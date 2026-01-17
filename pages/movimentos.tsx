import Head from 'next/head'
import { Activity } from 'lucide-react'
import PainelMovimentos from '../src/components/portas/PainelDiario'
import { useAuth } from '../src/contexts/AuthContext'
import { MainLayout } from '../components/MainLayout'

export default function MovimentosPage() {
  const { condominio } = useAuth()

  if (!condominio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <Activity size={32} className="text-white animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Carregando sistema...</h2>
            <p className="text-gray-600 text-center">Estamos preparando seus dados de movimentos</p>
            <div className="mt-6 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <MainLayout>
      <>
        <Head>
          <title>Movimentos das Portas - AIRE</title>
          <meta name="description" content="Histórico completo de entradas e saídas das portas" />
        </Head>

        <div className="w-full">
          <PainelMovimentos />
        </div>
      </>
    </MainLayout>
  )
}
