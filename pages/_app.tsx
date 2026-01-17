import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { AuthProvider } from '../src/contexts/AuthContext'
import { useAuth } from '../src/contexts/AuthContext'
import '../src/index.css'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  const publicRoutes = new Set(['/login', '/cadastro-morador', '/cadastro-condominio', '/comprovante'])
  const isPublic = publicRoutes.has(router.pathname)

  useEffect(() => {
    if (loading) return
    if (isPublic) return

    if (!usuario) {
      router.replace('/login')
    }
  }, [usuario, loading, isPublic, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isPublic && !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return <>{children}</>
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </AuthProvider>
  )
}
