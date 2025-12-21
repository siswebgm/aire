import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Loader2, Eye, EyeOff, Package, Building2, Shield, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
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
      navigate(perfil === 'KIOSK' ? '/totem-kiosk' : '/')
    } else {
      setError(result.error || 'Erro ao fazer login')
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900 flex">
      {/* Lado Esquerdo - Ilustração */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-28 w-[520px] h-[520px] bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/4 w-40 h-40 bg-indigo-300/15 rounded-full blur-2xl"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/70 via-indigo-950/70 to-sky-900/70"></div>
        
        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          {/* Ilustração SVG de Gaveteiros */}
          <div className="mb-8">
            <svg width="320" height="280" viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Prédio */}
              <rect x="60" y="60" width="200" height="200" rx="8" fill="white" fillOpacity="0.15"/>
              <rect x="80" y="80" width="160" height="160" rx="4" fill="white" fillOpacity="0.1"/>
              
              {/* Gaveteiros (grid 3x4) */}
              {[0, 1, 2].map((col) => (
                [0, 1, 2, 3].map((row) => (
                  <g key={`${col}-${row}`}>
                    <rect 
                      x={95 + col * 45} 
                      y={95 + row * 35} 
                      width="35" 
                      height="25" 
                      rx="3" 
                      fill={(col + row) % 3 === 0 ? "#22c55e" : (col + row) % 3 === 1 ? "#ef4444" : "#3b82f6"}
                      fillOpacity="0.9"
                    />
                    <text 
                      x={112 + col * 45} 
                      y={112 + row * 35} 
                      fill="white" 
                      fontSize="10" 
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {col * 4 + row + 1}
                    </text>
                  </g>
                ))
              ))}
              
              {/* Pessoa estilizada */}
              <g transform="translate(250, 170)">
                {/* Corpo */}
                <ellipse cx="35" cy="65" rx="22" ry="28" fill="white" fillOpacity="0.95"/>
                {/* Cabeça */}
                <circle cx="35" cy="25" r="18" fill="#fcd34d"/>
                {/* Rosto feliz */}
                <circle cx="29" cy="23" r="2" fill="#1e293b"/>
                <circle cx="41" cy="23" r="2" fill="#1e293b"/>
                <path d="M28 30 Q35 36 42 30" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round"/>
                {/* Cabelo */}
                <path d="M20 18 Q25 8 35 8 Q45 8 50 18" fill="#92400e" />
                {/* Braços */}
                <ellipse cx="12" cy="60" rx="8" ry="12" fill="white" fillOpacity="0.95"/>
                <ellipse cx="58" cy="55" rx="8" ry="12" fill="white" fillOpacity="0.95"/>
              </g>
              
              {/* Pacote bonito */}
              <g transform="translate(248, 230)">
                <rect x="0" y="0" width="35" height="28" rx="4" fill="#f59e0b"/>
                <rect x="0" y="0" width="35" height="8" rx="4" fill="#fbbf24"/>
                <line x1="17" y1="0" x2="17" y2="28" stroke="#b45309" strokeWidth="3"/>
                <line x1="0" y1="14" x2="35" y2="14" stroke="#b45309" strokeWidth="3"/>
                {/* Laço */}
                <circle cx="17" cy="0" r="6" fill="#dc2626"/>
                <circle cx="11" cy="-4" r="4" fill="#dc2626"/>
                <circle cx="23" cy="-4" r="4" fill="#dc2626"/>
              </g>
              
              {/* Ícone de notificação */}
              <circle cx="270" cy="70" r="15" fill="#22c55e"/>
              <path d="M265 70 L268 73 L276 65" stroke="white" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          
          {/* Texto */}
          <h2 className="text-4xl font-bold text-white text-center mb-2">
            AIRE
          </h2>
          <p className="text-sky-200 text-center text-sm mb-4 font-semibold">
            Armário Inteligente de Recebimentos e Entregas
          </p>
          <p className="text-white/70 text-center text-base max-w-md mb-8">
            Controle completo de armários, moradores e entregas do seu condomínio em um só lugar.
          </p>
          
          {/* Features */}
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-2">
                <Package className="text-white" size={24} />
              </div>
              <span className="text-white/80 text-sm">Entregas<br/>Seguras</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-2">
                <Shield className="text-white" size={24} />
              </div>
              <span className="text-white/80 text-sm">Controle<br/>Total</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-2">
                <Clock className="text-white" size={24} />
              </div>
              <span className="text-white/80 text-sm">Tempo<br/>Real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          {/* Logo Mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4 shadow-lg border border-white/15">
              <Building2 size={32} className="text-white" />
            </div>
            <div className="text-white font-extrabold text-2xl tracking-tight">AIRE</div>
            <div className="mt-1 text-white/70 text-sm font-semibold">Acesso ao sistema</div>
          </div>

          {/* Card de Login */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/20">
            {/* Título */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Bem-vindo!</h1>
              <p className="text-slate-500 text-sm mt-1 font-semibold">Faça login para acessar o sistema</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50/90 border border-slate-200 rounded-xl 
                             focus:ring-2 focus:ring-sky-200 focus:border-sky-400 focus:bg-white
                             placeholder:text-slate-400 transition-all"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="senha" className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="senha"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50/90 border border-slate-200 rounded-xl 
                             focus:ring-2 focus:ring-sky-200 focus:border-sky-400 focus:bg-white
                             placeholder:text-slate-400 transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Esqueci minha senha */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => alert('Funcionalidade em desenvolvimento. Entre em contato com o administrador.')}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}

              {/* Botão de Login */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-600 to-blue-700 text-white 
                         py-4 rounded-xl font-extrabold text-base shadow-md shadow-blue-500/15
                         hover:from-sky-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/20
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 flex items-center justify-center gap-2
                         transform"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
