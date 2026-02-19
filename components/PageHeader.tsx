import type { ReactNode } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft } from 'lucide-react'

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  leftAction?: ReactNode
  sticky?: boolean
  showBack?: boolean
  backTo?: string
  borderless?: boolean
  borderTone?: 'light' | 'medium'
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  leftAction,
  sticky = true,
  showBack = true,
  backTo,
  borderless = false,
  borderTone = 'light'
}: PageHeaderProps) {
  const router = useRouter()

  const resolvedLeftAction =
    leftAction ??
    (showBack ? (
      <button
        type="button"
        onClick={() => backTo ? router.push(backTo) : router.back()}
        className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        aria-label="Voltar"
      >
        <ArrowLeft size={18} />
      </button>
    ) : null)

  return (
    <div className={sticky ? 'sticky top-0 z-30' : ''}>
      <div
        className={
          'bg-white/80 backdrop-blur-sm rounded-2xl overflow-visible ' +
          (borderless
            ? ''
            : borderTone === 'medium'
              ? 'border border-slate-200/90'
              : 'border border-gray-100')
        }
      >
        <div
          className={
            sticky
              ? `p-4 sm:p-5 ${
                  borderless
                    ? ''
                    : borderTone === 'medium'
                      ? 'border-b border-slate-200/70'
                      : 'border-b border-gray-100/70'
                }`
              : 'p-4 sm:p-5'
          }
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {resolvedLeftAction}
              {!showBack && icon && (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/20 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">{title}</h1>
                {subtitle ? <div className="mt-0.5 text-sm text-slate-500 truncate">{subtitle}</div> : null}
              </div>
            </div>

            {actions ? <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">{actions}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
