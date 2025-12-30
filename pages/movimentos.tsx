import { useState } from 'react'
import Head from 'next/head'
import { ArrowLeft, Activity, TrendingUp, TrendingDown, Clock, Calendar, Filter } from 'lucide-react'
import { useRouter } from 'next/router'
import PainelMovimentos from '../src/components/portas/PainelDiario'
import { useAuth } from '../src/contexts/AuthContext'

export default function MovimentosPage() {
  const { condominio } = useAuth()
  const router = useRouter()

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
    <>
      <Head>
        <title>Movimentos das Portas - AIRE</title>
        <meta name="description" content="Histórico completo de entradas e saídas das portas" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
        {/* Header Moderno */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 shadow-2xl border-b border-blue-800">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="group flex items-center justify-center w-10 h-10 text-white hover:bg-white/20 rounded-xl transition-all duration-300 hover:scale-105"
                >
                  <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                    <Activity size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-wide">Movimentos das Portas</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <p className="text-sm text-blue-100 font-medium">{condominio.nome}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Stats rápidas no header */}
              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-2 text-white/80">
                    <TrendingUp size={16} />
                    <span className="text-sm">Entradas</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2 text-white/80">
                    <TrendingDown size={16} />
                    <span className="text-sm">Saídas</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2 text-white/80">
                    <Clock size={16} />
                    <span className="text-sm">Hoje</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <PainelMovimentos />
        </div>
      </div>
    </>
  )
}
