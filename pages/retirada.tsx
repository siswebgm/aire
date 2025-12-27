import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/contexts/AuthContext'
import AbrirPortaPublico from '../src/pages/AbrirPortaPublico'

export default function RetiradaPage() {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !usuario) {
      router.push('/login')
    }
  }, [usuario, loading, router])

  if (loading || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return <AbrirPortaPublico />
}
