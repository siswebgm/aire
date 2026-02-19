import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  Building2,
  Camera,
  Home,
  Loader2,
  Mail,
  Plus,
  Save,
  Trash2,
  Users,
  Phone,
  UserPlus,
  Link2,
  Copy,
  Check,
  X
} from 'lucide-react'
import QRCode from 'react-qr-code'
import { useAuth } from '../../src/contexts/AuthContext'
import type { Apartamento, Bloco, ContatoAdicional, TipoMorador } from '../../src/types/gaveteiro'
import { criarMorador, listarApartamentos, listarBlocos } from '../../src/services/gaveteiroService'
import { supabase } from '../../src/lib/supabaseClient'
import { MainLayout } from '../../components/MainLayout'
import { PageHeader } from '../../components/PageHeader'

const onlyDigits = (value: string) => value.replace(/\D/g, '')

function formatNomePtBr(value: string) {
  const ignorarMinusculo = new Set(['de', 'da', 'do', 'dos', 'das'])
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

export default function NovoMoradorPage() {
  const { condominio } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [facialFile, setFacialFile] = useState<File | null>(null)
  const [facialPreviewUrl, setFacialPreviewUrl] = useState<string | null>(null)
  const [facialQuality, setFacialQuality] = useState<{ ok: boolean; message: string } | null>(null)
  const [contatoFacialFiles, setContatoFacialFiles] = useState<Record<number, File | null>>({})
  const [contatoFacialPreviewUrls, setContatoFacialPreviewUrls] = useState<Record<number, string>>({})
  const [contatoFacialQuality, setContatoFacialQuality] = useState<Record<number, { ok: boolean; message: string }>>({})
  const contatoFacialPreviewUrlsRef = useRef<Record<number, string>>({})

  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string>('')
  const [cameraTarget, setCameraTarget] = useState<{ kind: 'morador' } | { kind: 'contato'; idx: number } | null>(
    null
  )
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const moradorFileInputRef = useRef<HTMLInputElement | null>(null)
  const contatoFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const [linkLoading, setLinkLoading] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string>('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [mostrarLinkPublico, setMostrarLinkPublico] = useState(true)

  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])

  const [blocoUid, setBlocoUid] = useState<string>('')
  const [apartamentoNumero, setApartamentoNumero] = useState<string>('')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [tipo, setTipo] = useState<TipoMorador>('PROPRIETARIO')
  const [contatosAdicionais, setContatosAdicionais] = useState<ContatoAdicional[]>([])

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

  const abrirSelecaoArquivo = (target: { kind: 'morador' } | { kind: 'contato'; idx: number }) => {
    if (target.kind === 'morador') {
      moradorFileInputRef.current?.click()
      return
    }
    contatoFileInputRefs.current[target.idx]?.click()
  }

  const abrirFacial = async (target: { kind: 'morador' } | { kind: 'contato'; idx: number }) => {
    // Preferir webcam quando disponível; caso falhe, abrir seletor de arquivos (que no mobile pode abrir a câmera).
    if (typeof navigator !== 'undefined' && typeof navigator?.mediaDevices?.getUserMedia === 'function') {
      try {
        await abrirCamera(target)
        return
      } catch {
        // fallback
      }
    }

    abrirSelecaoArquivo(target)
  }

  const abrirCamera = async (target: { kind: 'morador' } | { kind: 'contato'; idx: number }) => {
    setCameraError('')
    setCameraTarget(target)
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
    if (!videoRef.current || !cameraTarget) return
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

    if (cameraTarget.kind === 'morador') {
      await handleSelecionarFacialMorador(file)
    } else {
      await handleSelecionarFacialContato(cameraTarget.idx, file)
    }

    setCameraOpen(false)
    setCameraTarget(null)
    pararCamera()
  }

  useEffect(() => {
    if (!cameraOpen) {
      pararCamera()
      setCameraTarget(null)
      setCameraError('')
    }
  }, [cameraOpen])

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

      // Luma mean
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

      // Variância do Laplaciano (proxy de nitidez)
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

      // Thresholds conservadores
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
      URL.revokeObjectURL(url)
    }
  }

  const handleSelecionarFacialMorador = async (file: File | null) => {
    setError('')
    if (!file) {
      setFacialQuality(null)
      setFacialFile(null)
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

  const setContatoFacialFile = (idx: number, file: File | null) => {
    setContatoFacialFiles((prev) => ({ ...prev, [idx]: file }))

    setContatoFacialPreviewUrls((prev) => {
      const next = { ...prev }
      const current = next[idx]
      if (current) URL.revokeObjectURL(current)

      if (file) {
        next[idx] = URL.createObjectURL(file)
      } else {
        delete next[idx]
      }

      contatoFacialPreviewUrlsRef.current = next
      return next
    })
  }

  const handleSelecionarFacialContato = async (idx: number, file: File | null) => {
    setError('')
    if (!file) {
      setContatoFacialQuality((prev) => {
        const next = { ...prev }
        delete next[idx]
        return next
      })
      setContatoFacialFile(idx, null)
      return
    }

    const q = await validarFotoFacial(file)
    setContatoFacialQuality((prev) => ({ ...prev, [idx]: q }))
    if (!q.ok) {
      setContatoFacialFile(idx, null)
      return
    }

    setContatoFacialFile(idx, file)
  }

  const removerContato = (idx: number) => {
    setContatoFacialQuality((prev) => {
      const next: Record<number, { ok: boolean; message: string }> = {}
      for (const [k, v] of Object.entries(prev)) {
        const i = Number(k)
        if (Number.isNaN(i) || i === idx) continue
        next[i > idx ? i - 1 : i] = v
      }
      return next
    })

    try {
      delete contatoFileInputRefs.current[idx]
      const nextRefs: Record<number, HTMLInputElement | null> = {}
      for (const [k, v] of Object.entries(contatoFileInputRefs.current)) {
        const i = Number(k)
        if (Number.isNaN(i) || i === idx) continue
        nextRefs[i > idx ? i - 1 : i] = v
      }
      contatoFileInputRefs.current = nextRefs
    } catch {
      // ignore
    }

    setContatoFacialPreviewUrls((prev) => {
      const next: Record<number, string> = {}
      for (const [k, url] of Object.entries(prev)) {
        const i = Number(k)
        if (Number.isNaN(i)) continue

        if (i === idx) {
          URL.revokeObjectURL(url)
          continue
        }

        next[i > idx ? i - 1 : i] = url
      }
      contatoFacialPreviewUrlsRef.current = next
      return next
    })

    setContatosAdicionais((prev) => prev.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    if (!condominio?.uid) return
    void carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.uid])

  useEffect(() => {
    if (!router.isReady) return

    const qBlocoUid = typeof router.query.blocoUid === 'string' ? router.query.blocoUid : ''
    const qApartamento = typeof router.query.apartamento === 'string' ? router.query.apartamento : ''

    if (qBlocoUid) setBlocoUid(qBlocoUid)
    if (qApartamento) setApartamentoNumero(qApartamento)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  const carregarDados = async () => {
    if (!condominio?.uid) return
    setLoading(true)
    setError('')

    try {
      const [blocosData, apartamentosData] = await Promise.all([
        listarBlocos(condominio.uid),
        listarApartamentos(condominio.uid)
      ])

      setBlocos(blocosData)
      setApartamentos(apartamentosData)
    } catch (err) {
      console.error('Erro ao carregar blocos/apartamentos:', err)
      setError('Erro ao carregar blocos e apartamentos')
    } finally {
      setLoading(false)
    }

  }

  useEffect(() => {
    if (!facialFile) {
      if (facialPreviewUrl) {
        URL.revokeObjectURL(facialPreviewUrl)
        setFacialPreviewUrl(null)
      }
      return
    }

    const url = URL.createObjectURL(facialFile)
    setFacialPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [facialFile])

  useEffect(() => {
    return () => {
      Object.values(contatoFacialPreviewUrlsRef.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // ignore
        }
      })
    }
  }, [])

  const gerarLinkPublico = async () => {
    if (!condominio?.uid) return

    setLinkLoading(true)
    setLinkCopied(false)
    setError('')
    try {
      const res = await fetch('/api/public/morador-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condominioUid: condominio.uid })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Erro ao gerar link')
      }
      setLinkUrl(String(data.url))

      try {
        await navigator.clipboard.writeText(String(data.url))
        setLinkCopied(true)
        window.setTimeout(() => setLinkCopied(false), 2500)
      } catch {
        // ignore - fallback manual
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao gerar link')
    } finally {
      setLinkLoading(false)
    }
  }

  const blocoSelecionado = useMemo(() => {
    if (!blocoUid) return null
    return blocos.find((b) => b.uid === blocoUid) || null
  }, [blocos, blocoUid])

  const apartamentosFiltrados = useMemo(() => {
    if (!blocoUid) {
      return apartamentos
        .filter((a) => !a.bloco_uid)
        .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
    }

    return apartamentos
      .filter((a) => a.bloco_uid === blocoUid)
      .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
  }, [apartamentos, blocoUid])

  const salvar = async () => {
    if (!condominio?.uid) return

    setError('')

    if (!nome.trim()) {
      setError('Nome é obrigatório')
      return
    }

    const whatsappDigits = onlyDigits(whatsapp).trim()
    if (!whatsappDigits) {
      setError('WhatsApp é obrigatório')
      return
    }
    if (whatsappDigits.length < 10) {
      setError('WhatsApp inválido')
      return
    }

    if (!blocoUid) {
      setError('Bloco é obrigatório')
      return
    }

    if (!apartamentoNumero.trim()) {
      setError('Apartamento é obrigatório')
      return
    }

    const contatosBase = (contatosAdicionais || []).map((c) => ({
      nome: String(c?.nome || '').trim(),
      whatsapp: onlyDigits(String(c?.whatsapp || '')).trim(),
      email: String((c as any)?.email || '')
        .trim()
        .toLowerCase(),
      facial_url: (c as any)?.facial_url ? String((c as any).facial_url) : ''
    }))

    const contatosValidos = contatosBase
      .map((c, idx) => ({ ...c, __idx: idx }))
      .filter((c) => c.nome || c.whatsapp || c.email || c.facial_url)

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
      const bucket = String(condominio?.storage || '').trim()

      const precisaBucket = !!facialFile || contatosValidos.some((c) => !!contatoFacialFiles[c.__idx])
      if (precisaBucket && !bucket) {
        throw new Error('Condomínio sem bucket de storage configurado (condominio.storage).')
      }

      let facialUrl: string | null = null

      if (facialFile) {
        const ext = (facialFile.name.split('.').pop() || 'jpg').toLowerCase()
        const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg'
        const fileId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`

        const filePath = `${condominio.uid}/moradores/${fileId}.${safeExt}`
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, facialFile, {
          upsert: true,
          contentType: facialFile.type || 'image/jpeg'
        })

        if (uploadError) {
          throw uploadError
        }

        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath)
        facialUrl = publicData?.publicUrl || null
      }

      const contatos: ContatoAdicional[] = await Promise.all(
        contatosValidos.map(async (c) => {
          const file = contatoFacialFiles[c.__idx]
          if (!file) {
            return {
              nome: c.nome,
              whatsapp: c.whatsapp,
              email: c.email || undefined,
              facial_url: c.facial_url || undefined
            }
          }

          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
          const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg'
          const fileId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`

          const filePath = `${condominio.uid}/moradores/contatos/${fileId}.${safeExt}`
          const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
            upsert: true,
            contentType: file.type || 'image/jpeg'
          })
          if (uploadError) throw uploadError

          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath)
          return {
            nome: c.nome,
            whatsapp: c.whatsapp,
            email: c.email || undefined,
            facial_url: publicData?.publicUrl || undefined
          }
        })
      )

      await criarMorador({
        condominio_uid: condominio.uid,
        nome: formatNomePtBr(nome),
        email: email.trim().toLowerCase() || null,
        whatsapp: whatsappDigits || null,
        facial_url: facialUrl,
        bloco: blocoSelecionado?.nome || null,
        apartamento: apartamentoNumero.trim(),
        tipo,
        contatos_adicionais: contatos,
        observacao: null,
        ativo: true
      } as any)

      await router.push('/moradores')
    } catch (err: any) {
      const code = err?.code || err?.status
      if (code === '23505') {
        setError('Já existe um morador cadastrado para este bloco/apartamento')
      } else {
        console.error('Erro ao salvar morador:', err)
        setError('Erro ao salvar morador')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!condominio) {
    return (
      <MainLayout>
        <div className="w-full py-10 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-500">Carregando...</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <>
        <Head>
          <title>Novo Morador - AIRE</title>
          <meta name="description" content="Cadastro de novo morador" />
        </Head>

        <div className="w-full space-y-6">
          <PageHeader
            title="Novo Morador"
            sticky={false}
            actions={
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={gerarLinkPublico}
                  disabled={linkLoading || loading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-slate-700
                           bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  {linkLoading ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
                  <span className="hidden sm:inline">Gerar link público</span>
                  <span className="sm:hidden">Link</span>
                </button>

                <button
                  onClick={salvar}
                  disabled={saving || loading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                           bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md disabled:opacity-60"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Salvar
                </button>
              </div>
            }
          />

          {linkUrl && mostrarLinkPublico ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">Link público de cadastro</p>
                  <p className="text-xs text-slate-500">Envie este link para o morador preencher o cadastro (sem login).</p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarLinkPublico(false)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-slate-700
                             bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Ocultar
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(linkUrl)
                        setLinkCopied(true)
                        window.setTimeout(() => setLinkCopied(false), 2500)
                      } catch {
                        // ignore
                      }
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-slate-700
                             bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    {linkCopied ? <Check size={18} className="text-emerald-700" /> : <Copy size={18} />}
                    {linkCopied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-[11px] font-semibold text-slate-700 mb-2">Link</div>
                  <input
                    value={linkUrl}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">Dica: você pode enviar o QR Code pelo WhatsApp.</p>
                </div>

                <div className="w-full lg:w-[156px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="w-full aspect-square rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-2">
                    <QRCode value={linkUrl} size={120} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {linkUrl && !mostrarLinkPublico ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">Link público oculto</p>
                <p className="text-xs text-slate-500">Clique em mostrar para exibir o link e o QR Code.</p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarLinkPublico(true)}
                className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-slate-700
                         bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Mostrar
              </button>
            </div>
          ) : null}

          {error && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="glass-card rounded-2xl overflow-visible mt-6">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Users size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Dados do Morador</h2>
                  <p className="text-sm text-gray-500">Preencha os campos abaixo</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {loading ? (
                <div className="py-10 text-center">
                  <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
                  <p className="mt-2 text-gray-500">Carregando blocos e apartamentos...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
                        <input
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          onBlur={() => setNome((v) => formatNomePtBr(v))}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="Nome completo"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                        <div className="relative">
                          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => setEmail((v) => (v || '').trim().toLowerCase())}
                            inputMode="email"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="email@dominio.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Facial (foto)</label>
                      <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="relative group">
                              <button
                                type="button"
                                className="w-[72px] h-[72px] rounded-2xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shadow-sm cursor-pointer hover:ring-2 hover:ring-sky-500/20 hover:border-sky-300 transition-all"
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

                              <div className="hidden group-focus-within:block absolute left-0 top-[calc(100%+10px)] z-[220] w-56">
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                  <div className="px-3 py-2 text-[11px] font-extrabold text-slate-600 bg-slate-50/60 border-b border-slate-100">
                                    Adicionar facial
                                  </div>
                                  <div className="p-2 grid grid-cols-1 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void abrirCamera({ kind: 'morador' })}
                                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-white
                                               bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600"
                                    >
                                      <Camera size={16} />
                                      Tirar foto
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => abrirSelecaoArquivo({ kind: 'morador' })}
                                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
                                    >
                                      <UserPlus size={16} />
                                      Enviar foto
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-slate-900">Foto para desbloqueio</p>
                              <p className="text-xs text-slate-500 truncate">
                                {facialFile?.name || 'Use uma foto frontal, com boa iluminação e sem blur.'}
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

                          <div className="flex flex-col sm:flex-row lg:justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void abrirFacial({ kind: 'morador' })}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                                       bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md"
                            >
                              <Camera size={16} />
                              Adicionar foto
                            </button>

                            <input
                              ref={moradorFileInputRef}
                              type="file"
                              accept="image/*"
                              capture="user"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null
                                void handleSelecionarFacialMorador(f)
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => void handleSelecionarFacialMorador(null)}
                              disabled={!facialFile}
                              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-sm text-rose-700 disabled:opacity-50 disabled:hover:bg-rose-50"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp *</label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(formatWhatsAppBr(e.target.value))}
                            onBlur={() => setWhatsapp((v) => formatWhatsAppBr(v))}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="(00)0 0000-0000"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bloco *</label>
                        <div className="relative">
                          <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <select
                            value={blocoUid}
                            onChange={(e) => {
                              setBlocoUid(e.target.value)
                              setApartamentoNumero('')
                            }}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option value="">Selecione</option>
                            {blocos.map((b) => (
                              <option key={b.uid} value={b.uid}>
                                {b.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Apartamento *</label>
                        <div className="relative">
                          <Home size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <select
                            value={apartamentoNumero}
                            onChange={(e) => setApartamentoNumero(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option value="">Selecione</option>
                            {apartamentosFiltrados.map((a) => (
                              <option key={a.uid} value={a.numero}>
                                {a.numero}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                        <select
                          value={tipo}
                          onChange={(e) => setTipo(e.target.value as TipoMorador)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="PROPRIETARIO">Proprietário</option>
                          <option value="INQUILINO">Inquilino</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl overflow-visible mt-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Contatos adicionais</h2>
                <p className="text-sm text-gray-500">Opcional: para notificação (WhatsApp e/ou email)</p>
              </div>
              <button
                type="button"
                onClick={() => setContatosAdicionais((prev) => [...prev, { nome: '', whatsapp: '', email: '' }])}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Adicionar contato
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {contatosAdicionais.length === 0 ? (
                <div className="text-sm text-slate-500 bg-white/70 border border-slate-200 rounded-xl px-4 py-3">
                  Nenhum contato adicional.
                </div>
              ) : (
                contatosAdicionais.map((c, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-sm font-semibold text-slate-800">Contato {idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removerContato(idx)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 size={16} />
                        Remover
                      </button>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Facial (foto)</label>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-3 items-center">
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              <button
                                type="button"
                                className="w-12 h-12 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-sky-500/20 hover:border-sky-300 transition-all"
                                aria-label="Opções de foto"
                              >
                                {contatoFacialPreviewUrls[idx] ? (
                                  <img
                                    src={contatoFacialPreviewUrls[idx]}
                                    alt={`Prévia da facial do contato ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                                    <UserPlus size={16} className="text-slate-400" />
                                  </div>
                                )}
                              </button>

                              <div className="hidden group-focus-within:block absolute left-0 top-[calc(100%+10px)] z-[220] w-56">
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                  <div className="px-3 py-2 text-[11px] font-extrabold text-slate-600 bg-slate-50/60 border-b border-slate-100">
                                    Adicionar facial
                                  </div>
                                  <div className="p-2 grid grid-cols-1 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void abrirCamera({ kind: 'contato', idx })}
                                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-white
                                               bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600"
                                    >
                                      <Camera size={16} />
                                      Tirar foto
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => abrirSelecaoArquivo({ kind: 'contato', idx })}
                                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
                                    >
                                      <UserPlus size={16} />
                                      Enviar foto
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-slate-600">Foto para desbloqueio</div>
                              <div className="text-xs text-slate-500 truncate">
                                {contatoFacialFiles[idx]?.name || 'Opcional: adicione a foto do contato.'}
                              </div>
                              {contatoFacialQuality[idx] ? (
                                <div
                                  className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border
                                    ${contatoFacialQuality[idx].ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}
                                >
                                  {contatoFacialQuality[idx].message}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void abrirFacial({ kind: 'contato', idx })}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                                       bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md"
                            >
                              <Camera size={16} />
                              Adicionar foto
                            </button>

                            <input
                              ref={(el) => {
                                contatoFileInputRefs.current[idx] = el
                              }}
                              type="file"
                              accept="image/*"
                              capture="user"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null
                                void handleSelecionarFacialContato(idx, f)
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => void handleSelecionarFacialContato(idx, null)}
                              disabled={!contatoFacialFiles[idx] && !contatoFacialPreviewUrls[idx]}
                              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-sm text-rose-700 disabled:opacity-50 disabled:hover:bg-rose-50"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nome</label>
                        <input
                          value={c.nome}
                          onChange={(e) =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, nome: e.target.value } : item))
                            )
                          }
                          onBlur={() =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, nome: formatNomePtBr(String(item?.nome || '')) } : item
                              )
                            )
                          }
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="Ex.: Maria"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp</label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={c.whatsapp}
                            onChange={(e) =>
                              setContatosAdicionais((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, whatsapp: formatWhatsAppBr(e.target.value) } : item
                                )
                              )
                            }
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="(00)0 0000-0000"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={(c as any).email || ''}
                          onChange={(e) =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, email: e.target.value } : item))
                            )
                          }
                          onBlur={() =>
                            setContatosAdicionais((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, email: String((item as any)?.email || '').trim().toLowerCase() }
                                  : item
                              )
                            )
                          }
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="email@dominio.com"
                          inputMode="email"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {cameraOpen ? (
          <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-24 sm:pt-28">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setCameraOpen(false)} />

            <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-900 truncate">Capturar facial</p>
                  <p className="text-xs text-slate-500 truncate">Centralize o rosto e use boa iluminação.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4">
                {cameraError ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold">
                    {cameraError}
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-2xl bg-slate-900 overflow-hidden border border-slate-200">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void capturarFoto()}
                  disabled={!!cameraError}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                           bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md disabled:opacity-60"
                >
                  <Camera size={16} />
                  Capturar
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </>
    </MainLayout>
  )
}
