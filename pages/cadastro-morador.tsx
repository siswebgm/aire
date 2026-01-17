import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Building2, Camera, Home, Loader2, Save, CheckCircle2, XCircle, UserPlus, X, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../src/lib/supabaseClient'

type ApiBloco = {
  blocoUid: string
  blocoNome: string
  apartamentos: Array<{ uid: string; numero: string }>
}

const onlyDigits = (value: string) => (value || '').replace(/\D/g, '')

function formatNomePtBr(value: string) {
  const ignorarMinusculo = new Set(['de', 'da', 'do', 'dos', 'das', 'nos'])
  const limpo = (value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  if (!limpo) return ''

  return limpo
    .split(' ')
    .map((p, idx) => {
      if (idx !== 0 && ignorarMinusculo.has(p)) return p
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')
}

function formatWhatsAppBr(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 3) return `(${d.slice(0, 2)})${d.slice(2)}`
  if (d.length <= 7) return `(${d.slice(0, 2)})${d.slice(2, 3)} ${d.slice(3)}`
  return `(${d.slice(0, 2)})${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}

export default function CadastroMoradorPublicoPage() {
  const router = useRouter()
  const condominioUid = typeof router.query.condominioUid === 'string' ? router.query.condominioUid : ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const [condominioNome, setCondominioNome] = useState<string>('')
  const [bucket, setBucket] = useState<string>('')
  const [blocos, setBlocos] = useState<ApiBloco[]>([])

  const [blocoUid, setBlocoUid] = useState('')
  const [apartamento, setApartamento] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const [contatosAdicionais, setContatosAdicionais] = useState<Array<{ nome: string; whatsapp: string; email: string }>>([])

  const [contatoFacialFiles, setContatoFacialFiles] = useState<Record<number, File | null>>({})
  const [contatoFacialPreviewUrls, setContatoFacialPreviewUrls] = useState<Record<number, string>>({})
  const [contatoFacialQuality, setContatoFacialQuality] = useState<Record<number, { ok: boolean; message: string } | null>>({})

  const [facialFile, setFacialFile] = useState<File | null>(null)
  const [facialPreviewUrl, setFacialPreviewUrl] = useState<string>('')
  const [facialQuality, setFacialQuality] = useState<{ ok: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraTargetContatoIdx, setCameraTargetContatoIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!router.isReady) return
    if (!condominioUid) {
      setLoading(false)
      setError('Link inválido (condominioUid ausente).')
      return
    }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/public/moradores-disponiveis?condominioUid=${encodeURIComponent(condominioUid)}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data) {
          throw new Error(data?.error || 'Erro ao carregar dados')
        }

        setCondominioNome(data?.condominio?.nome || '')
        setBucket(String(data?.condominio?.storage || ''))
        setBlocos(Array.isArray(data?.blocos) ? data.blocos : [])
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [router.isReady, condominioUid])

  const apartamentosDisponiveis = useMemo(() => {
    const b = blocos.find((x) => x.blocoUid === blocoUid)
    return b?.apartamentos || []
  }, [blocos, blocoUid])

  useEffect(() => {
    setApartamento('')
  }, [blocoUid])

  const adicionarContato = () => {
    setContatosAdicionais((prev) => [...prev, { nome: '', whatsapp: '', email: '' }])
  }

  const removerContato = (idx: number) => {
    setContatosAdicionais((prev) => prev.filter((_, i) => i !== idx))

    setContatoFacialPreviewUrls((prev) => {
      const removed = prev[idx]
      if (removed) {
        try {
          URL.revokeObjectURL(removed)
        } catch {
          // ignore
        }
      }

      const next: Record<number, string> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k)
        if (Number.isNaN(i) || i === idx) return
        next[i > idx ? i - 1 : i] = v
      })
      return next
    })

    setContatoFacialFiles((prev) => {
      const next: Record<number, File | null> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k)
        if (Number.isNaN(i) || i === idx) return
        next[i > idx ? i - 1 : i] = v
      })
      return next
    })

    setContatoFacialQuality((prev) => {
      const next: Record<number, { ok: boolean; message: string } | null> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k)
        if (Number.isNaN(i) || i === idx) return
        next[i > idx ? i - 1 : i] = v
      })
      return next
    })
  }

  const validarFotoFacial = async (file: File): Promise<{ ok: boolean; message: string }> => {
    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
      return { ok: false, message: 'Arquivo muito grande. Envie uma foto de até 5MB.' }
    }

    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.decoding = 'async'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Falha ao ler imagem'))
        img.src = url
      })

      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height

      if (w < 320 || h < 320) {
        return { ok: false, message: 'Foto pequena. Use uma imagem com pelo menos 320x320.' }
      }

      const canvas = document.createElement('canvas')
      const target = 256
      canvas.width = target
      canvas.height = target
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return { ok: true, message: 'Foto adicionada.' }

      ctx.drawImage(img, 0, 0, target, target)
      const { data } = ctx.getImageData(0, 0, target, target)

      let sum = 0
      const n = target * target
      const gray = new Float32Array(n)
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
        gray[p] = y
        sum += y
      }
      const mean = sum / n

      let lapSum = 0
      let lapSum2 = 0
      const idx = (x: number, y: number) => y * target + x
      for (let y = 1; y < target - 1; y++) {
        for (let x = 1; x < target - 1; x++) {
          const c = gray[idx(x, y)]
          const up = gray[idx(x, y - 1)]
          const down = gray[idx(x, y + 1)]
          const left = gray[idx(x - 1, y)]
          const right = gray[idx(x + 1, y)]
          const lap = up + down + left + right - 4 * c
          lapSum += lap
          lapSum2 += lap * lap
        }
      }

      const count = (target - 2) * (target - 2)
      const lapMean = lapSum / count
      const lapVar = lapSum2 / count - lapMean * lapMean

      if (mean < 60) {
        return { ok: false, message: 'Foto muito escura. Aumente a iluminação do rosto.' }
      }
      if (mean > 210) {
        return { ok: false, message: 'Foto muito clara/estourada. Evite contraluz ou flash.' }
      }
      if (lapVar < 35) {
        return { ok: false, message: 'Foto com pouco foco (borrada). Tire outra mais nítida.' }
      }

      return { ok: true, message: 'Boa foto: nítida e bem iluminada.' }
    } catch {
      return { ok: true, message: 'Foto adicionada.' }
    } finally {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    }
  }

  const handleSelecionarFacial = async (file: File | null) => {
    setError('')
    if (!file) {
      setFacialFile(null)
      setFacialQuality(null)
      return
    }

    const q = await validarFotoFacial(file)
    setFacialQuality(q)
    if (!q.ok) {
      setFacialFile(null)
      return
    }

    setFacialFile(file)
  }

  const handleSelecionarContatoFacial = async (idx: number, file: File | null) => {
    setError('')
    if (!file) {
      setContatoFacialFiles((prev) => ({ ...prev, [idx]: null }))
      setContatoFacialQuality((prev) => ({ ...prev, [idx]: null }))
      setContatoFacialPreviewUrls((prev) => {
        const old = prev[idx]
        if (old) {
          try {
            URL.revokeObjectURL(old)
          } catch {
            // ignore
          }
        }
        const next = { ...prev }
        delete (next as any)[idx]
        return next
      })
      return
    }

    const q = await validarFotoFacial(file)
    setContatoFacialQuality((prev) => ({ ...prev, [idx]: q }))
    if (!q.ok) {
      setContatoFacialFiles((prev) => ({ ...prev, [idx]: null }))
      return
    }

    setContatoFacialFiles((prev) => ({ ...prev, [idx]: file }))
    setContatoFacialPreviewUrls((prev) => {
      const old = prev[idx]
      if (old) {
        try {
          URL.revokeObjectURL(old)
        } catch {
          // ignore
        }
      }
      return { ...prev, [idx]: URL.createObjectURL(file) }
    })
  }

  useEffect(() => {
    if (!facialFile) {
      if (facialPreviewUrl) {
        try {
          URL.revokeObjectURL(facialPreviewUrl)
        } catch {
          // ignore
        }
      }
      setFacialPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(facialFile)
    setFacialPreviewUrl(url)
    return () => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facialFile])

  const pararCamera = () => {
    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop())
    } catch {
      // ignore
    }
    streamRef.current = null
    if (videoRef.current) {
      try {
        ;(videoRef.current as any).srcObject = null
      } catch {
        // ignore
      }
    }
  }

  const abrirCamera = async (targetContatoIdx: number | null = null) => {
    setCameraError('')
    setCameraTargetContatoIdx(targetContatoIdx)
    setCameraOpen(true)
    await new Promise((r) => setTimeout(r, 0))

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Câmera não suportada neste dispositivo/navegador.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        ;(videoRef.current as any).srcObject = stream
        await videoRef.current.play().catch(() => null)
      }
    } catch (e: any) {
      setCameraError(e?.message || 'Não foi possível acessar a câmera')
    }
  }

  const capturarFoto = async () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9))
    if (!blob) return
    const file = new File([blob], `facial-${Date.now()}.jpg`, { type: 'image/jpeg' })

    if (cameraTargetContatoIdx !== null) {
      await handleSelecionarContatoFacial(cameraTargetContatoIdx, file)
    } else {
      await handleSelecionarFacial(file)
    }

    setCameraOpen(false)
    pararCamera()
  }

  useEffect(() => {
    if (!cameraOpen) {
      pararCamera()
      setCameraError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen])

  const salvar = async () => {
    if (!condominioUid) return

    setError('')
    setSuccess('')

    if (!nome.trim()) {
      setError('Nome é obrigatório')
      return
    }
    if (!whatsapp.trim()) {
      setError('WhatsApp é obrigatório')
      return
    }
    if (!blocoUid) {
      setError('Selecione o bloco')
      return
    }
    if (!apartamento) {
      setError('Selecione o apartamento')
      return
    }

    const contatosBase = (contatosAdicionais || []).map((c, idx) => ({
      nome: String(c?.nome || '').trim(),
      whatsapp: onlyDigits(String(c?.whatsapp || '')).trim(),
      email: String(c?.email || '')
        .trim()
        .toLowerCase(),
      __idx: idx
    }))

    const contatosValidos = contatosBase.filter((c) => c.nome || c.whatsapp || c.email || contatoFacialFiles[c.__idx])

    const invalid = contatosValidos.some((c) => {
      const temContato = !!(c.whatsapp || c.email)
      const temNome = !!c.nome
      return (temContato && !temNome) || (temNome && !temContato)
    })
    if (invalid) {
      setError('Contatos adicionais: preencha nome e ao menos um contato (WhatsApp ou email)')
      return
    }

    setSaving(true)
    try {
      const precisaBucket = !!facialFile || contatosValidos.some((c) => !!contatoFacialFiles[c.__idx])
      if (precisaBucket && !bucket) {
        throw new Error('Condomínio sem bucket de storage configurado.')
      }

      let facialUrl: string | null = null
      if (facialFile) {
        const ext = (facialFile.name.split('.').pop() || 'jpg').toLowerCase()
        const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg'
        const fileId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`

        const filePath = `${condominioUid}/moradores/public/${fileId}.${safeExt}`
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, facialFile, {
          upsert: true,
          contentType: facialFile.type || 'image/jpeg'
        })
        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath)
        facialUrl = publicData?.publicUrl || null
      }

      const contatosPayload = await Promise.all(
        contatosValidos.map(async (c) => {
          const file = contatoFacialFiles[c.__idx]
          if (!file) {
            return {
              nome: c.nome,
              whatsapp: c.whatsapp,
              email: c.email || '',
              facial_url: ''
            }
          }

          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
          const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg'
          const fileId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`

          const filePath = `${condominioUid}/moradores/contatos/public/${fileId}.${safeExt}`
          const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'image/jpeg'
          })
          if (uploadError) throw uploadError
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath)

          return {
            nome: c.nome,
            whatsapp: c.whatsapp,
            email: c.email || '',
            facial_url: publicData?.publicUrl || ''
          }
        })
      )

      const res = await fetch('/api/public/cadastrar-morador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condominioUid,
          nome,
          email,
          whatsapp,
          blocoUid,
          apartamento,
          facial_url: facialUrl,
          contatos_adicionais: contatosPayload
        })
      })

      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Erro ao salvar')
      }

      setSuccess('Cadastro realizado com sucesso!')
      setNome('')
      setEmail('')
      setWhatsapp('')
      setBlocoUid('')
      setApartamento('')
      setFacialFile(null)
      setFacialPreviewUrl('')
      setFacialQuality(null)
      setContatosAdicionais([])
      setContatoFacialFiles({})
      setContatoFacialPreviewUrls({})
      setContatoFacialQuality({})
      setShowSuccessModal(true)

      try {
        const res2 = await fetch(`/api/public/moradores-disponiveis?condominioUid=${encodeURIComponent(condominioUid)}`)
        const data2 = await res2.json().catch(() => null)
        if (res2.ok && data2) {
          setBlocos(Array.isArray(data2?.blocos) ? data2.blocos : [])
        }
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>Cadastro de Morador</title>
        <meta name="description" content="Cadastro público de morador" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/20 flex-shrink-0">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">Cadastro de Morador</h1>
                <p className="mt-0.5 text-sm text-slate-500 truncate">{condominioNome || 'Condomínio'}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <Loader2 size={32} className="animate-spin mx-auto text-sky-600" />
              <p className="mt-2 text-slate-500">Carregando...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-6">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                  <XCircle size={18} className="text-rose-700" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-slate-900">Não foi possível abrir o formulário</p>
                  <p className="mt-1 text-sm text-rose-700">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
              <div className="p-6 border-b border-slate-100">
                <p className="text-sm text-slate-600">Preencha seus dados para concluir o cadastro.</p>
              </div>

              <div className="p-6 space-y-5">
                {success ? (
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-700 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-emerald-800">{success}</p>
                      <p className="text-sm text-emerald-700">Você já pode fechar esta página.</p>
                    </div>
                  </div>
                ) : null}

                {!success && error ? (
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-medium text-sm">{error}</div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Facial (foto)</label>
                    <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm p-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="relative group">
                          <button
                            type="button"
                            disabled={!!success}
                            className="w-[72px] h-[72px] rounded-2xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shadow-sm cursor-pointer hover:ring-2 hover:ring-sky-500/20 hover:border-sky-300 transition-all disabled:opacity-60"
                            aria-label="Opções de foto"
                          >
                            {facialPreviewUrl ? (
                              <img src={facialPreviewUrl} alt="Prévia da facial" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                                <UserPlus size={20} className="text-slate-400" />
                              </div>
                            )}
                          </button>

                          {!success ? (
                            <div className="hidden group-focus-within:block absolute left-0 top-[calc(100%+10px)] z-[220] w-56">
                              <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                <div className="px-3 py-2 text-[11px] font-extrabold text-slate-600 bg-slate-50/60 border-b border-slate-100">
                                  Adicionar facial
                                </div>
                                <div className="p-2 grid grid-cols-1 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void abrirCamera()}
                                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-white
                                             bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600"
                                  >
                                    <Camera size={16} />
                                    Tirar foto
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
                                  >
                                    <UserPlus size={16} />
                                    Enviar foto
                                  </button>

                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="user"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0] || null
                                      void handleSelecionarFacial(f)
                                    }}
                                  />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFacialFile(null)
                                      setFacialPreviewUrl('')
                                      setFacialQuality(null)
                                    }}
                                    disabled={!facialFile && !facialPreviewUrl}
                                    className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-sm text-rose-700 disabled:opacity-50 disabled:hover:bg-rose-50"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-slate-900">Foto para desbloqueio</p>
                          <p className="text-xs text-slate-500 truncate">
                            {facialFile?.name || 'Opcional: use uma foto frontal com boa iluminação.'}
                          </p>
                          {facialQuality ? (
                            <div
                              className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border
                                ${facialQuality.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}
                            >
                              {facialQuality.message}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nome *</label>
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      onBlur={() => setNome((v) => formatNomePtBr(v))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      placeholder="Nome completo"
                      disabled={!!success}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp *</label>
                    <input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatWhatsAppBr(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      placeholder="(00) 0 0000-0000"
                      disabled={!!success}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      placeholder="email@dominio.com"
                      disabled={!!success}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Bloco *</label>
                    <select
                      value={blocoUid}
                      onChange={(e) => setBlocoUid(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      disabled={!!success}
                    >
                      <option value="">Selecione</option>
                      {blocos.map((b) => (
                        <option key={b.blocoUid} value={b.blocoUid}>
                          {b.blocoNome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Apartamento *</label>
                    <div className="relative">
                      <select
                        value={apartamento}
                        onChange={(e) => setApartamento(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                        disabled={!blocoUid || !!success}
                      >
                        <option value="">Selecione</option>
                        {apartamentosDisponiveis.map((a) => (
                          <option key={a.uid} value={a.numero}>
                            {a.numero}
                          </option>
                        ))}
                      </select>
                      <Home size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-900">Contatos adicionais (opcional)</p>
                        <p className="text-xs text-slate-500">Preencha nome e ao menos um contato (WhatsApp ou e-mail).</p>
                      </div>

                      <button
                        type="button"
                        onClick={adicionarContato}
                        disabled={!!success}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-sm text-slate-700 disabled:opacity-60"
                      >
                        <Plus size={16} />
                        Adicionar contato
                      </button>
                    </div>

                    {contatosAdicionais.length ? (
                      <div className="mt-3 space-y-3">
                        {contatosAdicionais.map((c, idx) => (
                          <div key={idx} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-extrabold text-slate-900">Contato {idx + 1}</p>
                              <button
                                type="button"
                                onClick={() => removerContato(idx)}
                                disabled={!!success}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-sm text-rose-700 disabled:opacity-60"
                              >
                                <Trash2 size={16} />
                                Remover
                              </button>
                            </div>

                            <div className="mt-3">
                              <label className="block text-xs font-bold text-slate-600 mb-1">Facial (foto)</label>
                              <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm p-4">
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="relative group">
                                    <button
                                      type="button"
                                      disabled={!!success}
                                      className="w-[64px] h-[64px] rounded-2xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shadow-sm cursor-pointer hover:ring-2 hover:ring-sky-500/20 hover:border-sky-300 transition-all disabled:opacity-60"
                                      aria-label="Opções de foto"
                                    >
                                      {contatoFacialPreviewUrls[idx] ? (
                                        <img
                                          src={contatoFacialPreviewUrls[idx]}
                                          alt="Prévia da facial"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                                          <UserPlus size={18} className="text-slate-400" />
                                        </div>
                                      )}
                                    </button>

                                    {!success ? (
                                      <div className="hidden group-focus-within:block absolute left-0 top-[calc(100%+10px)] z-[220] w-56">
                                        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                          <div className="px-3 py-2 text-[11px] font-extrabold text-slate-600 bg-slate-50/60 border-b border-slate-100">
                                            Atualizar facial
                                          </div>
                                          <div className="p-2 grid grid-cols-1 gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void abrirCamera(idx)}
                                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-white
                                                       bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600"
                                            >
                                              <Camera size={16} />
                                              Tirar foto
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                const el = document.getElementById(`contato-file-${idx}`) as HTMLInputElement | null
                                                el?.click()
                                              }}
                                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
                                            >
                                              <UserPlus size={16} />
                                              Enviar foto
                                            </button>

                                            <input
                                              id={`contato-file-${idx}`}
                                              type="file"
                                              accept="image/*"
                                              capture="user"
                                              className="hidden"
                                              onChange={(e) => {
                                                const f = e.target.files?.[0] || null
                                                void handleSelecionarContatoFacial(idx, f)
                                              }}
                                            />

                                            <button
                                              type="button"
                                              onClick={() => void handleSelecionarContatoFacial(idx, null)}
                                              disabled={!contatoFacialFiles[idx] && !contatoFacialPreviewUrls[idx]}
                                              className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-sm text-rose-700 disabled:opacity-50 disabled:hover:bg-rose-50"
                                            >
                                              Remover
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="min-w-0">
                                    <p className="text-sm font-extrabold text-slate-900">Foto do contato</p>
                                    <p className="text-xs text-slate-500 truncate">
                                      {contatoFacialFiles[idx]?.name || 'Opcional.'}
                                    </p>
                                    {contatoFacialQuality[idx] ? (
                                      <div
                                        className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border
                                          ${contatoFacialQuality[idx]?.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}
                                      >
                                        {contatoFacialQuality[idx]?.message}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="sm:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Nome</label>
                                <input
                                  value={c.nome}
                                  onChange={(e) =>
                                    setContatosAdicionais((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x))
                                    )
                                  }
                                  onBlur={() =>
                                    setContatosAdicionais((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, nome: formatNomePtBr(x.nome) } : x))
                                    )
                                  }
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                  placeholder="Nome"
                                  disabled={!!success}
                                />
                              </div>

                              <div className="sm:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 mb-1">WhatsApp</label>
                                <input
                                  value={c.whatsapp}
                                  onChange={(e) =>
                                    setContatosAdicionais((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, whatsapp: formatWhatsAppBr(e.target.value) } : x))
                                    )
                                  }
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                  placeholder="(00) 0 0000-0000"
                                  disabled={!!success}
                                />
                              </div>

                              <div className="sm:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 mb-1">E-mail</label>
                                <input
                                  value={c.email}
                                  onChange={(e) =>
                                    setContatosAdicionais((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x))
                                    )
                                  }
                                  onBlur={() =>
                                    setContatosAdicionais((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, email: (x.email || '').trim().toLowerCase() } : x))
                                    )
                                  }
                                  inputMode="email"
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                  placeholder="email@dominio.com"
                                  disabled={!!success}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={salvar}
                    disabled={saving || !!success}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white
                             bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Enviar cadastro
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 text-center">
            Este formulário é seguro e válido apenas para unidades disponíveis.
          </div>
        </div>

        {cameraOpen ? (
          <div className="fixed inset-0 z-[120] flex items-start justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setCameraOpen(false)} />

            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden mt-10">
              <div className="p-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-base font-extrabold">Tirar foto</p>
                  <p className="text-xs opacity-90">Centralize o rosto e mantenha boa iluminação</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4">
                {cameraError ? (
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold">
                    {cameraError}
                  </div>
                ) : null}

                <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-black">
                  <video ref={videoRef} className="w-full h-[320px] sm:h-[420px] object-cover" playsInline muted />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void capturarFoto()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                           bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md"
                >
                  <Camera size={16} />
                  Capturar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showSuccessModal ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setShowSuccessModal(false)}
            />

            <div className="relative w-full max-w-md rounded-2xl border border-emerald-200 bg-white shadow-xl overflow-hidden">
              <div className="p-5 bg-emerald-600 text-white flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-extrabold">Parabéns!</p>
                  <p className="mt-0.5 text-sm opacity-90">Seu cadastro foi realizado com sucesso.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <div className="p-5">
                <p className="text-sm text-slate-700">Você pode sair desta página agora.</p>
              </div>

              <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.href = 'https://www.google.com'
                  }}
                  className="px-4 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
