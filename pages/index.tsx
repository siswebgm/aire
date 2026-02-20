import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/contexts/AuthContext'
import TodasPortas from '../src/components/portas/TodasPortas'
import { MainLayout } from '../components/MainLayout'

export default function Home() {
  const { usuario, condominio, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !usuario) {
      router.push('/login')
    }
    // Redirecionar usuário KIOSK para a página do totem
    if (!loading && usuario?.perfil === 'KIOSK') {
      router.push('/pdv')
    }
  }, [usuario, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!usuario || !condominio?.ativo) {
    return null
  }

  return (
    <MainLayout>
      <TodasPortas />
    </MainLayout>
  )
}
