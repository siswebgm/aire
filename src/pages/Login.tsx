import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Lock, Mail, Loader2, Eye, EyeOff, Building2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email.trim()) {
      setError('Digite seu email')
      return
    }
    if (!senha) {
      setError('Digite sua senha')
      return
    }

    setLoading(true)
    const result = await login(email, senha)
    setLoading(false)

    if (result.success) {
      const savedUser = localStorage.getItem('gvt_usuario')
      const perfil = savedUser ? JSON.parse(savedUser)?.perfil : undefined
      router.push(perfil === 'KIOSK' ? '/pdv' : '/')
    } else {
      setError(result.error || 'Erro ao fazer login')
    }
  }

  return (
    <div className="h-screen min-h-0 w-full bg-[#0f172a] flex flex-col lg:flex-row overflow-hidden">
      {/* Parte esquerda - Logo */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-8">
        <div className="text-center">
          <img
            src="/logo-airebox_noite.png"
            alt="AireBox"
            className="w-48 sm:w-64 h-auto mx-auto"
            draggable={false}
          />
        </div>
      </div>

      {/* Parte direita - Formulário de Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-6">
        <div className="w-full max-w-md">
          {/* Card de Login */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl p-5 sm:p-6 border border-white/20">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 text-left">Login</h1>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50/90 border border-slate-200 rounded-lg 
                             focus:ring-2 focus:ring-sky-200 focus:border-sky-400 focus:bg-white
                             placeholder:text-slate-400 transition-all text-sm"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="senha" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="senha"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50/90 border border-slate-200 rounded-lg 
                             focus:ring-2 focus:ring-sky-200 focus:border-sky-400 focus:bg-white
                             placeholder:text-slate-400 transition-all text-sm"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Esqueci minha senha */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => alert('Funcionalidade em desenvolvimento. Entre em contato com o administrador.')}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-50 text-red-600 px-3 py-2.5 rounded-lg text-xs font-medium border border-red-100">
                  {error}
                </div>
              )}

              {/* Botão de Login */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-600 to-blue-700 text-white 
                         py-3 rounded-lg font-extrabold text-sm shadow-md shadow-blue-500/15
                         hover:from-sky-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/20
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 flex items-center justify-center gap-2
                         transform"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>

              <div className="pt-1">
                <Link
                  href="/cadastro-condominio"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-extrabold text-xs border border-white/25 bg-slate-900/5 hover:bg-slate-900/10 text-slate-800 transition-colors"
                >
                  <Building2 size={14} />
                  Cadastrar condomínio
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
