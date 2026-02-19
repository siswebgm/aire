import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  Activity,
  Building2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  User,
  Users,
  Wifi,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../src/contexts/AuthContext'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { usuario, condominio, logout } = useAuth()
  const router = useRouter()
  const isTotem = router.pathname === '/totem'
  const [menuAberto, setMenuAberto] = useState(false)
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aire_sidebar_collapsed')
      if (saved === '1') setSidebarRecolhida(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('aire_sidebar_collapsed', sidebarRecolhida ? '1' : '0')
    } catch {
      // ignore
    }
  }, [sidebarRecolhida])

  const navItems: Array<{
    href: string
    label: string
    icon: LucideIcon
    adminOnly?: boolean
  }> = [
    { href: '/', label: 'Dashboard', icon: LayoutGrid },
    { href: '/totem-kiosk', label: 'Totem', icon: Package },
    { href: '/moradores', label: 'Moradores', icon: Users },
    { href: '/blocos', label: 'Blocos', icon: Building2 },
    { href: '/movimentos', label: 'Movimentos', icon: Activity },
    { href: '/configurar-esp32', label: 'Configurar ESP', icon: Wifi, adminOnly: true }
  ]

  const renderNavLinks = (opts?: { onNavigate?: () => void; collapsed?: boolean }) => {
    const collapsed = !!opts?.collapsed
    return (
      <div className="space-y-1">
        {navItems
          .filter((item) => !item.adminOnly || usuario?.perfil === 'ADMIN')
          .map((item) => {
            const active = router.pathname === item.href
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={opts?.onNavigate}
                className={
                  `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ` +
                  (active
                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md ring-1 ring-white/30'
                    : 'text-gray-700 hover:bg-gray-100 hover:shadow-sm hover:-translate-y-[1px]')
                }
              >
                <Icon size={18} className={active ? 'text-white' : 'text-gray-500'} />
                {!collapsed ? item.label : null}

                {collapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:block whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 shadow-lg">
                    {item.label}
                  </span>
                ) : null}
              </Link>
            )
          })}
      </div>
    )
  }

  return (
    <div className={`${isTotem ? 'bg-slate-50' : 'bg-gray-50/80'} flex flex-col min-h-screen w-full`}>
      <style jsx global>{`
        /* Scrollbar ultrafina */
        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.2);
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.4);
        }
        /* Firefox */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.2) transparent;
        }
      `}</style>
      <header
        className={
          isTotem
            ? 'fixed top-0 inset-x-0 z-[60] overflow-visible text-white shadow-lg bg-gradient-to-br from-slate-700/90 via-slate-600/90 to-slate-800/90 backdrop-blur-sm'
            : 'fixed top-0 inset-x-0 z-[60] overflow-visible bg-gradient-to-r from-sky-500/80 via-sky-600/80 to-blue-700/80 text-white shadow-lg backdrop-blur-sm'
        }
      >
        <div className="w-full px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {!isTotem && (
                <button
                  type="button"
                  onClick={() => setSidebarAberta(true)}
                  className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Abrir menu"
                >
                  <Menu size={20} className="text-white" />
                </button>
              )}
              <div className="flex items-center">
                <svg viewBox="0 0 36 26" className="w-9 h-9">
                  <rect x="1" y="1" width="16" height="11" rx="2" fill="#22c55e" />
                  <rect x="19" y="1" width="16" height="11" rx="2" fill="#ef4444" />
                  <rect x="1" y="14" width="16" height="11" rx="2" fill="#ef4444" />
                  <rect x="19" y="14" width="16" height="11" rx="2" fill="#22c55e" />
                  <text x="9" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                    1
                  </text>
                  <text x="27" y="9" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                    2
                  </text>
                  <text x="9" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                    3
                  </text>
                  <text x="27" y="22" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">
                    4
                  </text>
                </svg>
                <svg viewBox="0 0 28 44" className="w-5 h-8 -ml-2">
                  <ellipse cx="14" cy="30" rx="10" ry="12" fill="white" />
                  <circle cx="14" cy="12" r="10" fill="#fcd34d" />
                  <circle cx="11" cy="11" r="1.5" fill="#1e293b" />
                  <circle cx="17" cy="11" r="1.5" fill="#1e293b" />
                  <path d="M10 15 Q14 19 18 15" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                  <path d="M6 9 Q10 3 22 9" fill="#92400e" />
                  <rect x="2" y="34" width="11" height="9" rx="2" fill="#f59e0b" />
                  <line x1="7.5" y1="34" x2="7.5" y2="43" stroke="#b45309" strokeWidth="1.5" />
                  <circle cx="7.5" cy="34" r="2.5" fill="#dc2626" />
                </svg>
              </div>
              <h1
                className="text-lg sm:text-xl font-extrabold tracking-widest uppercase text-white drop-shadow-2xl"
                style={{
                  fontFamily: "'Montserrat', 'Inter', sans-serif",
                  letterSpacing: '0.15em',
                  textShadow: '3px 3px 6px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.3)'
                }}
              >
                AIRE
              </h1>
            </div>

            {usuario && (
              <div className="relative">
                <button
                  onClick={() => setMenuAberto(!menuAberto)}
                  className={
                    isTotem
                      ? 'flex items-center gap-2 bg-transparent hover:opacity-90 transition-all text-sm font-medium'
                      : 'flex items-center gap-2 bg-transparent hover:opacity-90 transition-all text-sm font-medium'
                  }
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-sky-600 rounded-full flex items-center justify-center group-hover:from-sky-400 group-hover:to-sky-500 transition-all">
                    <User size={16} className="text-white group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="hidden sm:inline text-white font-medium">{usuario.nome}</span>
                </button>

                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-[70]" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-[80]">
                      <div className="p-4 border-b border-slate-200 rounded-t-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {usuario.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{usuario.nome}</p>
                            <p className="text-xs text-slate-500">{usuario.email || 'Usuário'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 border-b border-slate-200">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Building2 size={14} className="text-slate-500" />
                          <span className="font-medium">{condominio?.nome || 'Condomínio'}</span>
                        </div>
                      </div>
                      <div className="px-3 py-2 border-b border-slate-200">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>AIRE v1.0</span>
                          <span>{new Date().getFullYear()}</span>
                        </div>
                      </div>
                      <div className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuAberto(false)
                            router.push('/perfil')
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-semibold text-sm"
                        >
                          <User size={16} />
                          Meu perfil
                        </button>
                        <button
                          onClick={() => {
                            logout()
                            setMenuAberto(false)
                          }}
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
      </header>

      <div className="h-14 sm:h-16" />

      <div className="flex flex-1 w-full min-h-0">
        {/* Sidebar desktop */}
        <div
          className={
            isTotem
              ? 'hidden'
              : `hidden sm:block ${sidebarRecolhida ? 'w-20' : 'w-64'} flex-shrink-0`
          }
        />
        <aside
          className={
            isTotem
              ? 'hidden'
              : `hidden sm:flex ${sidebarRecolhida ? 'w-20' : 'w-64'} fixed left-0 top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] flex-col bg-white/70 backdrop-blur-xl border-r border-gray-200/70 shadow-sm ring-1 ring-black/5 transition-[width] duration-200 overflow-y-auto z-50`
          }
        >
          <div className="p-4 border-b border-gray-200/70 bg-gradient-to-br from-white/80 via-white/60 to-slate-50/60 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className={sidebarRecolhida ? 'hidden' : 'min-w-0'}>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em]">Menu</p>
                <div className="mt-2 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-600/15 to-blue-700/10 ring-1 ring-sky-700/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-extrabold text-sky-800">
                      {String((condominio?.nome || 'C').trim()).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 leading-tight truncate">{condominio?.nome || 'Condomínio'}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSidebarRecolhida((v) => !v)}
                className="ml-auto inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100/70 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 ring-1 ring-slate-200/70 transition-colors"
                title={sidebarRecolhida ? 'Expandir menu' : 'Recolher menu'}
                aria-label={sidebarRecolhida ? 'Expandir menu' : 'Recolher menu'}
              >
                {sidebarRecolhida ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>
          </div>

          <nav className="p-3 flex-1 overflow-y-auto">
            {renderNavLinks({ collapsed: sidebarRecolhida })}
          </nav>
        </aside>

        {/* Sidebar mobile overlay */}
        {!isTotem && sidebarAberta && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40 sm:hidden" onClick={() => setSidebarAberta(false)} />
            <aside className="fixed inset-y-0 left-0 w-72 bg-white z-50 sm:hidden shadow-2xl">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Menu</p>
                  <p className="mt-1 text-sm font-extrabold text-gray-900 truncate">{condominio?.nome || 'Condomínio'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarAberta(false)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-gray-100"
                  aria-label="Fechar menu"
                >
                  <X size={20} className="text-gray-700" />
                </button>
              </div>

              <nav className="p-3">
                {renderNavLinks({ onNavigate: () => setSidebarAberta(false) })}
              </nav>
            </aside>
          </>
        )}

        <main className="flex-1 min-w-0 min-h-0 p-2 sm:p-3 lg:p-4 overflow-x-hidden bg-slate-100 flex flex-col items-stretch">
          <div className="w-full max-w-full flex flex-col min-h-full bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm p-3 sm:p-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
