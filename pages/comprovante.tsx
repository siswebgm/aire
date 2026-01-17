import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { CheckCircle2, Copy, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

function decodeBase64Utf8(input: string) {
  const base64 = input.replace(/\s/g, '')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  const decoded = new TextDecoder().decode(bytes)
  return decoded
}

function safeString(value: unknown) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' && value.trim() === '') return '—'
  return String(value)
}

function formatDateTimePtBr(value: unknown) {
  const s = typeof value === 'string' ? value : ''
  if (!s) return '—'
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return s
  return dt.toLocaleString('pt-BR')
}

export default function Comprovante() {
  const router = useRouter()
  const [payload, setPayload] = React.useState<any>(null)
  const [erro, setErro] = React.useState<string>('')
  const [verDetalhes, setVerDetalhes] = React.useState(false)

  React.useEffect(() => {
    if (!router.isReady) return

    const raw = router.query.d
    const d = Array.isArray(raw) ? raw[0] : raw

    if (!d) {
      setErro('Comprovante inválido: parâmetro ausente.')
      return
    }

    try {
      const json = decodeBase64Utf8(decodeURIComponent(d))
      const obj = JSON.parse(json)
      setPayload(obj)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível ler o comprovante.')
    }
  }, [router.isReady, router.query.d])

  const copiarJson = async () => {
    if (!payload) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>Comprovante</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="border-b border-slate-200 bg-emerald-50 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold tracking-[0.22em] text-emerald-700">COMPROVANTE</div>
            <div className="mt-1 text-xl font-extrabold tracking-tight text-emerald-950">Operação concluída com sucesso</div>
            <div className="mt-1 text-sm font-semibold text-emerald-900/80">Guarde este comprovante como garantia.</div>
          </div>
          <div className="shrink-0 w-11 h-11 bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {erro ? (
          <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {erro}
          </div>
        ) : null}

        {payload ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-extrabold tracking-wide text-slate-500">PORTA</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">{safeString(payload?.porta)}</div>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-extrabold tracking-wide text-slate-500">ENCOMENDAS</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">{safeString(payload?.total_encomendas)}</div>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-extrabold tracking-wide text-slate-500">DESTINOS</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">{safeString(payload?.total_destinos)}</div>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-extrabold tracking-wide text-slate-500">DATA/HORA</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900 break-words">{formatDateTimePtBr(payload?.finalizado_em)}</div>
              </div>
            </div>

            <div className="mt-4 border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] font-extrabold tracking-wide text-slate-500">DESTINATÁRIOS</div>
              <div className="mt-2 grid gap-2">
                {(Array.isArray(payload?.destinatarios) ? payload.destinatarios : []).map((d: any, idx: number) => (
                  <div key={idx} className="border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-sm font-extrabold text-slate-900">Bloco {safeString(d?.bloco)} • Ap {safeString(d?.apartamento)}</div>
                    <div className="text-xs font-semibold text-slate-600">Quantidade: {safeString(d?.quantidade)}</div>
                  </div>
                ))}

                {(!Array.isArray(payload?.destinatarios) || payload.destinatarios.length === 0) ? (
                  <div className="text-xs font-semibold text-slate-500">—</div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setVerDetalhes(v => !v)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-slate-900"
              >
                <div>
                  <div className="text-[11px] font-extrabold tracking-wide text-slate-500">DETALHES TÉCNICOS</div>
                  <div className="text-xs font-semibold text-slate-600">JSON do comprovante (para auditoria)</div>
                </div>
                <div className="shrink-0 inline-flex items-center gap-2 text-xs font-extrabold">
                  {verDetalhes ? 'Ocultar' : 'Ver'}
                  {verDetalhes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {verDetalhes ? (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={copiarJson}
                      className="h-9 px-3 border border-slate-200 bg-white text-slate-900 text-xs font-extrabold inline-flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar
                    </button>
                  </div>
                  <pre className="mt-2 text-xs leading-relaxed whitespace-pre-wrap break-words text-slate-800">{JSON.stringify(payload, null, 2)}</pre>
                </div>
              ) : null}
            </div>

            <div className="mt-4 text-center text-[11px] font-semibold text-slate-500">
              Mesmo fora da rede do condomínio, este comprovante funciona (os dados estão no QRCode).
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
