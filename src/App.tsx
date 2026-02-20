import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import GaveteirosDashboard from './pages/GaveteirosDashboard'
import MoradoresPage from './pages/MoradoresPage'
import NovoMoradorPage from './pages/NovoMoradorPage'
import BlocosApartamentosPage from './pages/BlocosApartamentosPage'
import RelatorioGaveteiros from './pages/RelatorioGaveteiros'
import Esp32TestePage from './pages/Esp32TestePage'
import AbrirPortaPublico from './pages/AbrirPortaPublico'
import GaveteirosTotem from './pages/GaveteirosTotem'
import Login from './pages/Login'
import { LogOut, User, LayoutGrid, Users, Building2, Package, FileSpreadsheet, AlertTriangle, DoorOpen } from 'lucide-react'

// Tela de condomínio inativo
function CondominioInativo({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">Acesso Suspenso</h1>
        <p className="text-gray-600 mb-6">
          O condomínio associado à sua conta está temporariamente inativo. 
          Entre em contato com o administrador do sistema para mais informações.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800 text-sm">
            <strong>Motivo:</strong> Conta do condomínio desativada
          </p>
        </div>
        <button
          onClick={onLogout}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Sair do Sistema
        </button>
      </div>
    </div>
  )
}

// Componente de rota protegida
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario, condominio, loading, logout } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  // Verificar se condomínio está ativo
  if (!condominio?.ativo) {
    return <CondominioInativo onLogout={logout} />
  }

  // Perfil KIOSK só pode acessar a rota /pdv
  if (usuario?.perfil === 'KIOSK' && location.pathname !== '/pdv' && location.pathname !== '/retirada') {
    return <Navigate to="/pdv" replace />
  }

  return <>{children}</>
}

// Layout principal com header e navegação
function MainLayout({ children }: { children: React.ReactNode }) {
  const { usuario, condominio, logout } = useAuth()
  const location = useLocation()
  const isTotem = location.pathname === '/totem'

  return (
    <div className={isTotem ? 'bg-slate-50 flex flex-col' : 'bg-white flex flex-col'}>
      <header
        className={
          isTotem
            ? 'text-white shadow-xl bg-gradient-to-br from-blue-950 via-indigo-950 to-sky-900'
            : 'bg-indigo-700 text-white shadow-xl'
        }
      >
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo e Nome */}
            <div className="flex items-center gap-2.5">
              {/* Logo completa */}
              <div className="flex items-center">
                <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-md overflow-hidden p-1">
                  <svg viewBox="0 0 36 26" className="w-full h-full">
                    <rect x="1" y="1" width="16" height="11" rx="2" fill="#22c55e"/>
                    <rect x="19" y="1" width="16" height="11" rx="2" fill="#ef4444"/>
                    <rect x="1" y="14" width="16" height="11" rx="2" fill="#ef4444"/>
                    <rect x="19" y="14" width="16" height="11" rx="2" fill="#22c55e"/>
                    <text x="9" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">1</text>
                    <text x="27" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">2</text>
                    <text x="9" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">3</text>
                    <text x="27" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">4</text>
                  </svg>
                </div>
                {/* Boneco sobreposto */}
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
              <h1 className="text-xl font-extrabold tracking-widest uppercase" style={{ fontFamily: "'Montserrat', 'Inter', sans-serif", letterSpacing: '0.15em' }}>AIRE</h1>
            </div>
            
            {/* Usuário com Dropdown */}
            {usuario && (
              <div className="relative group">
                <button
                  className={
                    isTotem
                      ? 'flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-white/10 rounded-xl transition-all text-sm font-medium'
                      : 'flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-all text-sm font-medium'
                  }
                >
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <span className="hidden sm:inline">{usuario.nome}</span>
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl 
                              border border-gray-100 opacity-0 invisible group-hover:opacity-100 
                              group-hover:visible transition-all duration-200 z-50">
                  {/* Header do dropdown */}
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        {usuario.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{usuario.nome}</p>
                        <p className="text-xs text-gray-500">{usuario.email || 'Usuário'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Informações do condomínio */}
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 size={14} className="text-blue-500" />
                      <span className="font-medium">{condominio?.nome || 'Condomínio'}</span>
                    </div>
                  </div>
                  
                  {/* Versão */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>AIRE v1.0</span>
                      <span>{new Date().getFullYear()}</span>
                    </div>
                  </div>
                  
                  {/* Botão Sair */}
                  <div className="p-2">
                    <button
                      onClick={logout}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 
                               text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
                    >
                      <LogOut size={16} />
                      Sair do Sistema
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Menu de Navegação */}
        <nav
          className={
            isTotem
              ? 'border-t border-gray-100 bg-white shadow-sm py-2.5'
              : 'bg-white border-t border-gray-100 shadow-sm py-2.5'
          }
        >
          <div className="px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex gap-1 sm:gap-1.5 flex-1 overflow-x-auto">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isTotem
                    ? `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive
                    ? 'bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sky-700'}`
                    : `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-sm scale-[1.01]' 
                    : 'text-gray-500 hover:bg-white hover:text-indigo-700 hover:shadow-sm'}`
                }
              >
                <LayoutGrid size={16} />
                <span>Gaveteiros</span>
              </NavLink>
              <NavLink
                to="/totem"
                className={({ isActive }) =>
                  isTotem
                    ? `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive
                    ? 'bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sky-700'}`
                    : `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-sm scale-[1.01]' 
                    : 'text-gray-500 hover:bg-white hover:text-indigo-700 hover:shadow-sm'}`
                }
              >
                <Package size={16} />
                <span>Totem</span>
              </NavLink>
              <NavLink
                to="/moradores"
                className={({ isActive }) =>
                  isTotem
                    ? `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive
                    ? 'bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sky-700'}`
                    : `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-sm scale-[1.01]' 
                    : 'text-gray-500 hover:bg-white hover:text-indigo-700 hover:shadow-sm'}`
                }
              >
                <Users size={16} />
                <span>Moradores</span>
              </NavLink>
              <NavLink
                to="/blocos"
                className={({ isActive }) =>
                  isTotem
                    ? `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive
                    ? 'bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sky-700'}`
                    : `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-sm scale-[1.01]' 
                    : 'text-gray-500 hover:bg-white hover:text-indigo-700 hover:shadow-sm'}`
                }
              >
                <Building2 size={16} />
                <span>Blocos</span>
              </NavLink>
              <NavLink
                to="/relatorio"
                className={({ isActive }) =>
                  isTotem
                    ? `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive
                    ? 'bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sky-700'}`
                    : `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-sm scale-[1.01]' 
                    : 'text-gray-500 hover:bg-white hover:text-indigo-700 hover:shadow-sm'}`
                }
              >
                <FileSpreadsheet size={16} />
                <span>Relatório</span>
              </NavLink>
              {/* Teste ESP32 - Apenas para ADMIN */}
              {usuario?.perfil === 'ADMIN' && (
                <NavLink
                  to="/teste-hardware"
                  className={({ isActive }) =>
                    isTotem
                      ? `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                    ${isActive
                      ? 'bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-sky-700'}`
                      : `flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap
                    ${isActive 
                      ? 'bg-indigo-600 text-white shadow-sm scale-[1.01]' 
                      : 'text-gray-500 hover:bg-white hover:text-indigo-700 hover:shadow-sm'}`
                  }
                >
                  <DoorOpen size={16} />
                  <span>Teste ESP32</span>
                </NavLink>
              )}
            </div>
            
            {/* Ações Rápidas */}
            <div id="nav-actions" className="flex gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Os botões serão injetados pelo GaveteirosDashboard via portal */}
            </div>
          </div>
        </nav>
      </header>

      <main className="p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <GaveteirosDashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/moradores"
        element={
          <ProtectedRoute>
            <MainLayout>
              <MoradoresPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/moradores/novo"
        element={
          <ProtectedRoute>
            <MainLayout>
              <NovoMoradorPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/moradores/:uid/editar"
        element={
          <ProtectedRoute>
            <MainLayout>
              <NovoMoradorPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/blocos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <BlocosApartamentosPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatorio"
        element={
          <ProtectedRoute>
            <MainLayout>
              <RelatorioGaveteiros />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teste-hardware"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Esp32TestePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      {/* Página pública - não requer login */}
      <Route
        path="/retirada"
        element={
          <ProtectedRoute>
            <AbrirPortaPublico />
          </ProtectedRoute>
        }
      />
      {/* Página fullscreen para totem - focada em ocupar */}
      <Route
        path="/totem"
        element={
          <ProtectedRoute>
            <MainLayout>
              <GaveteirosTotem mode="embedded" />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      {/* Página kiosk/fullscreen do Totem (sem menu) */}
      <Route
        path="/pdv"
        element={
          <ProtectedRoute>
            <GaveteirosTotem mode="kiosk" />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
