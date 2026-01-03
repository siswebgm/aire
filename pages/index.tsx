import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/contexts/AuthContext'
import GaveteirosDashboard from '../src/pages/GaveteirosDashboard'
import { LogOut, User, LayoutGrid, Users, Building2, Package, FileSpreadsheet, Wifi, Activity } from 'lucide-react'
import Link from 'next/link'
import TodasPortas from '../src/components/portas/TodasPortas'

function MainLayout({ children }: { children: React.ReactNode }) {
  const { usuario, condominio, logout } = useAuth()
  const router = useRouter()
  const isTotem = router.pathname === '/totem'
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className={`${isTotem ? 'bg-slate-50' : 'bg-gray-50/80'} flex flex-col min-h-screen w-full`}>
      <header
        className={
          isTotem
            ? 'text-white shadow-xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900'
            : 'bg-gradient-to-r from-sky-600 via-sky-700 to-blue-800 text-white shadow-xl'
        }
      >
        <div className="w-full px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center">
                <svg viewBox="0 0 36 26" className="w-9 h-9">
                  <rect x="1" y="1" width="16" height="11" rx="2" fill="#22c55e"/>
                  <rect x="19" y="1" width="16" height="11" rx="2" fill="#ef4444"/>
                  <rect x="1" y="14" width="16" height="11" rx="2" fill="#ef4444"/>
                  <rect x="19" y="14" width="16" height="11" rx="2" fill="#22c55e"/>
                  <text x="9" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">1</text>
                  <text x="27" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">2</text>
                  <text x="9" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">3</text>
                  <text x="27" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">4</text>
                </svg>
                <svg viewBox="0 0 28 44" className="w-5 h-8 -ml-2">
                  <ellipse cx="14" cy="30" rx="10" ry="12" fill="white"/>
                  <circle cx="14" cy="12" r="10" fill="#fcd34d"/>
                  <circle cx="11" cy="11" r="1.5" fill="#1e293b"/>
                  <circle cx="17" cy="11" r="1.5" fill="#1e293b"/>
                  <path d="M10 15 Q14 19 18 15" stroke="#1e293b" strokeWidth="1.5" fill="none"/>
                  <path d="M6 9 Q10 3 22 9" fill="#92400e"/>
                  <rect x="2" y="34" width="11" height="9" rx="2" fill="#f59e0b"/>
                  <line x1="7.5" y1="34" x2="7.5" y2="43" stroke="#b45309" strokeWidth="1.5"/>
                  <circle cx="7.5" cy="34" r="2.5" fill="#dc2626"/>
                </svg>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-widest uppercase text-white drop-shadow-2xl" style={{ fontFamily: "'Montserrat', 'Inter', sans-serif", letterSpacing: '0.15em', textShadow: '3px 3px 6px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.3)' }}>AIRE</h1>
            </div>
            
            {usuario && (
              <div className="relative">
                <button
                  onClick={() => setMenuAberto(!menuAberto)}
                  className={
                    isTotem
                      ? 'flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-white/10 rounded-xl transition-all text-sm font-medium'
                      : 'flex items-center gap-2 px-3 py-2 bg-sky-700/20 hover:bg-sky-700/30 backdrop-blur-sm rounded-xl transition-all text-sm font-medium hover:shadow-lg hover:scale-[1.02]'
                  }
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-sky-600 rounded-full flex items-center justify-center group-hover:from-sky-400 group-hover:to-sky-500 transition-all">
                    <User size={16} className="text-white group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="hidden sm:inline text-white font-medium">{usuario.nome}</span>
                </button>
                
                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-gradient-to-br from-sky-50 to-blue-100 rounded-xl shadow-2xl border border-sky-200 z-50">
                      <div className="p-4 border-b border-sky-200 rounded-t-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {usuario.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sky-800">{usuario.nome}</p>
                            <p className="text-xs text-sky-600">{usuario.email || 'Usuário'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 border-b border-sky-200">
                        <div className="flex items-center gap-2 text-sm text-sky-700">
                          <Building2 size={14} className="text-sky-600" />
                          <span className="font-medium">{condominio?.nome || 'Condomínio'}</span>
                        </div>
                      </div>
                      <div className="px-3 py-2 border-b border-sky-200">
                        <div className="flex items-center justify-between text-xs text-sky-500">
                          <span>AIRE v1.0</span>
                          <span>{new Date().getFullYear()}</span>
                        </div>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => { logout(); setMenuAberto(false); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
                        >
                          <LogOut size={16} />
                          Sair do Sistema
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        
        <nav
          className={
            isTotem
              ? 'border-t border-gray-100 bg-white shadow-sm py-2 sm:py-2.5'
              : 'shadow-sm py-2 sm:py-2.5'
          }
          style={!isTotem ? { backgroundColor: '#0369a1' } : { backgroundColor: 'transparent' }}
        >
          <div className="w-full px-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex flex-wrap gap-1 sm:gap-1.5 flex-1">
              <Link
                href="/"
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-nowrap
                  ${router.pathname === '/' 
                    ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-white shadow-lg scale-[1.02] ring-2 ring-sky-300' 
                    : 'text-white/90 hover:bg-white/15 hover:text-white hover:scale-[1.01] hover:shadow-md'}`}
              >
                <LayoutGrid size={16} />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/totem"
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-nowrap
                  ${router.pathname === '/totem' 
                    ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-white shadow-lg scale-[1.02] ring-2 ring-sky-300' 
                    : 'text-white/90 hover:bg-white/15 hover:text-white hover:scale-[1.01] hover:shadow-md'}`}
              >
                <Package size={16} />
                <span>Totem</span>
              </Link>
              <Link
                href="/moradores"
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-nowrap
                  ${router.pathname === '/moradores' 
                    ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-white shadow-lg scale-[1.02] ring-2 ring-sky-300' 
                    : 'text-white/90 hover:bg-white/15 hover:text-white hover:scale-[1.01] hover:shadow-md'}`}
              >
                <Users size={16} />
                <span>Moradores</span>
              </Link>
              <Link
                href="/blocos"
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-nowrap
                  ${router.pathname === '/blocos' 
                    ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-white shadow-lg scale-[1.02] ring-2 ring-sky-300' 
                    : 'text-white/90 hover:bg-white/15 hover:text-white hover:scale-[1.01] hover:shadow-md'}`}
              >
                <Building2 size={16} />
                <span>Blocos</span>
              </Link>
              <Link
                href="/relatorio"
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-nowrap
                  ${router.pathname === '/relatorio' 
                    ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-white shadow-lg scale-[1.02] ring-2 ring-sky-300' 
                    : 'text-white/90 hover:bg-white/15 hover:text-white hover:scale-[1.01] hover:shadow-md'}`}
              >
                <FileSpreadsheet size={16} />
                <span>Relatório</span>
              </Link>
              <Link
                href="/movimentos"
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-nowrap
                  ${router.pathname === '/movimentos' 
                    ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-white shadow-lg scale-[1.02] ring-2 ring-sky-300' 
                    : 'text-white/90 hover:bg-white/15 hover:text-white hover:scale-[1.01] hover:shadow-md'}`}
              >
                <Activity size={16} />
                <span>Movimentos</span>
              </Link>
              {usuario?.perfil === 'ADMIN' && (
                <>
                  <Link
                    href="/configurar-esp32"
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-nowrap
                      ${router.pathname === '/configurar-esp32' 
                        ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-white shadow-lg scale-[1.02] ring-2 ring-sky-300' 
                        : 'text-white/90 hover:bg-white/15 hover:text-white hover:scale-[1.01] hover:shadow-md'}`}
                  >
                    <Wifi size={16} />
                    <span>Configurar ESP</span>
                  </Link>
                </>
              )}
            </div>
            
            <div id="nav-actions" className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            </div>
          </div>
        </nav>
      </header>

      <main className="w-full p-2 sm:p-4 lg:p-6 flex-1 overflow-x-hidden bg-gray-50/50">
        <div className="w-full max-w-full">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  const { usuario, condominio, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !usuario) {
      router.push('/login')
    }
    // Redirecionar usuário KIOSK para a página do totem
    if (!loading && usuario?.perfil === 'KIOSK') {
      router.push('/totem-kiosk')
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
