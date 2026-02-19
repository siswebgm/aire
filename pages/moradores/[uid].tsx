import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Building2, Camera, Home, Loader2, Mail, Phone, Plus, Save, Users, UserPlus, X } from 'lucide-react'
import { useAuth } from '../../src/contexts/AuthContext'
import type { Apartamento, Bloco, Morador, TipoMorador } from '../../src/types/gaveteiro'
import { atualizarMorador, listarApartamentos, listarBlocos, listarMoradores } from '../../src/services/gaveteiroService'
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

const normalizeContatosAdicionais = (
  value: any
): Array<{ nome: string; whatsapp: string; email: string }> => {
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr
      .filter(Boolean)
      .map((c: any) => ({
        nome: String(c?.nome ?? ''),
        whatsapp: String(c?.whatsapp ?? ''),
        email: String(c?.email ?? '')
      }))
      .filter((c) => c.nome || c.whatsapp || c.email)
  } catch {
    return []
  }
}

export default function MoradorDetalhesPage() {
  const { condominio } = useAuth()
  const router = useRouter()
  const uid = typeof router.query.uid === 'string' ? router.query.uid : ''
  const print = router.query.print === '1'
  const autoPrint = router.query.autoprint === '1'

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [morador, setMorador] = useState<Morador | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([])
  const [blocoUid, setBlocoUid] = useState<string>('')
  const [apartamentoNumero, setApartamentoNumero] = useState<string>('')
  const [tipo, setTipo] = useState<TipoMorador>('PROPRIETARIO')
  const [contatosAdicionais, setContatosAdicionais] = useState<
    Array<{ nome: string; whatsapp: string; email: string }>
  >([])
  const [observacao, setObservacao] = useState('')

  const [facialUrl, setFacialUrl] = useState<string>('')
  const [facialFile, setFacialFile] = useState<File | null>(null)
  const [facialPreviewUrl, setFacialPreviewUrl] = useState<string>('')
  const [facialQuality, setFacialQuality] = useState<{ ok: boolean; message: string } | null>(null)
  const [facialRemovida, setFacialRemovida] = useState(false)

  const [gerandoPdf, setGerandoPdf] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fichaPrintRef = useRef<HTMLDivElement | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const blocoSelecionado = useMemo(() => {
    if (!blocoUid) return null
    return blocos.find((b) => b.uid === blocoUid) || null
  }, [blocos, blocoUid])

  const blocoLabel = blocoSelecionado?.nome ? String(blocoSelecionado.nome) : morador?.bloco ? String(morador.bloco) : '—'
  const aptLabel = apartamentoNumero ? String(apartamentoNumero) : morador?.apartamento ? String(morador.apartamento) : '—'

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

  useEffect(() => {
    if (!condominio?.uid || !uid) return
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.uid, uid])

  useEffect(() => {
    if (!condominio?.uid) return
    void (async () => {
      try {
        const [b, a] = await Promise.all([
          listarBlocos(condominio.uid),
          listarApartamentos(condominio.uid)
        ])
        setBlocos(b)
        setApartamentos(a)
      } catch (err) {
        console.error('Erro ao carregar blocos/apartamentos:', err)
      }
    })()
  }, [condominio?.uid])

  useEffect(() => {
    if (!morador) return
    if (blocoUid) return
    if (!blocos.length) return
    const nomeBloco = String(morador.bloco || '').trim().toLowerCase()
    if (!nomeBloco) return
    const match = blocos.find((b) => String(b.nome || '').trim().toLowerCase() === nomeBloco)
    if (match) setBlocoUid(match.uid)
  }, [blocos, morador, blocoUid])

  useEffect(() => {
    if (!print) return
    if (!autoPrint) return
    if (loading) return
    if (!morador) return
    const t = window.setTimeout(() => {
      try {
        window.print()
      } catch {
        // ignore
      }
    }, 250)
    return () => window.clearTimeout(t)
  }, [print, loading, morador])

  const carregar = async () => {
    if (!condominio?.uid || !uid) return
    setLoading(true)
    setError('')

    try {
      const data = await listarMoradores(condominio.uid)
      const m = (data || []).find((x) => x.uid === uid) || null
      if (!m) {
        setMorador(null)
        setError('Morador não encontrado')
        return
      }

      setMorador(m)
      setNome(m.nome || '')
      setEmail(m.email || '')
      setWhatsapp(m.whatsapp || '')
      setFacialUrl(String((m as any).facial_url || ''))
      setFacialFile(null)
      setFacialPreviewUrl('')
      setFacialQuality(null)
      setFacialRemovida(false)
      setApartamentoNumero(m.apartamento || '')
      setTipo(m.tipo)
      setContatosAdicionais(normalizeContatosAdicionais((m as any).contatos_adicionais))
      setObservacao(String((m as any).observacao || ''))

      const nomeBloco = String(m.bloco || '').trim().toLowerCase()
      if (nomeBloco) {
        const match = blocos.find((b) => String(b.nome || '').trim().toLowerCase() === nomeBloco)
        if (match) setBlocoUid(match.uid)
      }
    } catch (err) {
      console.error('Erro ao carregar morador:', err)
      setError('Erro ao carregar morador')
    } finally {
      setLoading(false)
    }
  }

  const invalidContatos = useMemo(() => {
    return contatosAdicionais.some((c) => {
      const nomeTrim = String(c?.nome || '').trim()
      const whatsappTrim = onlyDigits(String(c?.whatsapp || '')).trim()
      const emailTrim = String(c?.email || '').trim()
      const temContato = !!(whatsappTrim || emailTrim)
      const temNome = !!nomeTrim
      return (temContato && !temNome) || (temNome && !temContato)
    })
  }, [contatosAdicionais])

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
      URL.revokeObjectURL(url)
    }
  }

  const handleSelecionarFacial = async (file: File | null) => {
    setError('')
    if (!file) {
      setFacialFile(null)
      setFacialQuality(null)
      setFacialPreviewUrl('')
      return
    }

    const q = await validarFotoFacial(file)
    setFacialQuality(q)
    if (!q.ok) {
      setFacialFile(null)
      setFacialPreviewUrl('')
      return
    }

    setFacialRemovida(false)
    setFacialFile(file)
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

  const abrirCamera = async () => {
    setCameraError('')
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
    await handleSelecionarFacial(file)
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
    if (!condominio?.uid || !morador?.uid) return

    setError('')
    setToast(null)

    if (!nome.trim()) {
      setError('Nome é obrigatório')
      return
    }

    if (!apartamentoNumero.trim()) {
      setError('Apartamento é obrigatório')
      return
    }

    if (invalidContatos) {
      setError('Contatos adicionais: preencha nome e ao menos um contato (WhatsApp ou email)')
      return
    }

    const contatos = contatosAdicionais
      .map((c) => ({
        nome: formatNomePtBr(String(c?.nome || '')),
        whatsapp: onlyDigits(String(c?.whatsapp || '')).trim(),
        email: String(c?.email || '').trim().toLowerCase()
      }))
      .filter((c) => c.nome || c.whatsapp || c.email)

    setSaving(true)
    try {
      const bucket = String((condominio as any)?.storage || '').trim()

      const precisaBucket = !!facialFile
      if (precisaBucket && !bucket) {
        throw new Error('Condomínio sem bucket de storage configurado (condominio.storage).')
      }

      let nextFacialUrl: string | null | undefined = facialRemovida ? null : facialUrl || null

      if (facialFile) {
        const ext = (facialFile.name.split('.').pop() || 'jpg').toLowerCase()
        const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg'
        const fileId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`

        const filePath = `${condominio.uid}/moradores/${morador.uid}/${fileId}.${safeExt}`
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, facialFile, {
          upsert: true,
          contentType: facialFile.type || 'image/jpeg'
        })
        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath)
        nextFacialUrl = publicData?.publicUrl || null
      }

      const atualizado = await atualizarMorador(morador.uid, {
        nome: formatNomePtBr(nome),
        email: email.trim().toLowerCase() || null,
        whatsapp: onlyDigits(whatsapp).trim() || null,
        facial_url: nextFacialUrl,
        bloco: blocoSelecionado?.nome || null,
        apartamento: apartamentoNumero.trim(),
        tipo,
        contatos_adicionais: contatos,
        observacao: observacao.trim() || null
      } as any)

      setMorador(atualizado)
      setFacialUrl(String((atualizado as any).facial_url || ''))
      setFacialFile(null)
      setFacialPreviewUrl('')
      setFacialQuality(null)
      setFacialRemovida(false)
      setContatosAdicionais(normalizeContatosAdicionais((atualizado as any).contatos_adicionais))
      setApartamentoNumero(atualizado.apartamento || '')
      setObservacao(String((atualizado as any).observacao || ''))
      setToast({ type: 'success', message: 'Morador atualizado com sucesso.' })
    } catch (err) {
      const code = (err as any)?.code || (err as any)?.status
      if (code === '23505') {
        setError('Já existe um morador cadastrado para este bloco/apartamento')
        setToast({ type: 'error', message: 'Já existe um morador cadastrado para este bloco/apartamento.' })
      } else {
        console.error('Erro ao salvar morador:', err)
        setError('Erro ao salvar morador')
        setToast({ type: 'error', message: 'Erro ao salvar morador.' })
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

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

  if (print) {
    return (
      <>
        <Head>
          <title>Ficha do Morador - AIRE</title>
          <meta name="description" content="Ficha do morador" />
        </Head>

        <div className="min-h-screen bg-slate-50 flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl">
            <div className="print:hidden mb-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (gerandoPdf) return
                  const el = fichaPrintRef.current
                  if (!el) return
                  setGerandoPdf(true)
                  try {
                    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                      import('html2canvas'),
                      import('jspdf')
                    ])

                    const canvas = await html2canvas(el, {
                      scale: 2,
                      backgroundColor: '#ffffff',
                      useCORS: true
                    })

                    const imgData = canvas.toDataURL('image/png')
                    const pdf = new jsPDF({
                      orientation: 'p',
                      unit: 'mm',
                      format: 'a4'
                    })

                    const pageWidth = pdf.internal.pageSize.getWidth()
                    const pageHeight = pdf.internal.pageSize.getHeight()
                    const imgProps = pdf.getImageProperties(imgData)
                    const imgWidth = pageWidth
                    const imgHeight = (imgProps.height * imgWidth) / imgProps.width

                    let y = 0
                    let remaining = imgHeight

                    while (remaining > 0) {
                      pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight)
                      remaining -= pageHeight
                      if (remaining > 0) {
                        pdf.addPage()
                        y -= pageHeight
                      }
                    }

                    const nomeArquivoBase = (morador?.nome ? String(morador.nome) : 'morador')
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9\-\s]/g, '')
                      .replace(/\s+/g, '-')
                      .slice(0, 80)

                    pdf.save(`ficha-${nomeArquivoBase || 'morador'}.pdf`)
                  } catch (err) {
                    console.error('Erro ao gerar PDF do morador:', err)
                    setToast({ type: 'error', message: 'Não foi possível gerar o PDF.' })
                  } finally {
                    setGerandoPdf(false)
                  }
                }}
                className="h-10 px-4 rounded-xl font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60"
                disabled={gerandoPdf || loading || !morador}
              >
                {gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    window.print()
                  } catch {
                    // ignore
                  }
                }}
                className="h-10 px-4 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
              >
                Imprimir
              </button>
            </div>

            <div ref={fichaPrintRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-6 border-b border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">
                      Ficha do Morador
                    </div>
                    <div className="mt-2 text-[28px] font-extrabold text-slate-900 leading-[1.15] break-words pr-2">
                      {morador?.nome || '—'}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700">
                        Bloco: {blocoLabel}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700">
                        Apto: {aptLabel}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                        {morador?.tipo === 'PROPRIETARIO' ? 'Proprietário' : 'Inquilino'}
                      </span>
                    </div>
                  </div>

                  {morador?.facial_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={String((morador as any).facial_url)}
                      alt="Facial"
                      className="w-20 h-20 rounded-2xl border border-slate-200 object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">Email</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 break-words">
                      {morador?.email ? String(morador.email) : '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">WhatsApp</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 break-words">
                      {morador?.whatsapp ? String(morador.whatsapp) : '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">Condomínio</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 break-words">
                      {condominio?.nome ? String(condominio.nome) : '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">UID</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 break-all">
                      {morador?.uid ? String(morador.uid) : '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">Contatos adicionais</div>
                  <div className="mt-2 space-y-2">
                    {contatosAdicionais.length > 0 ? (
                      contatosAdicionais.map((c, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1.2fr] gap-2">
                          <div className="text-sm font-semibold text-slate-900 break-words">{c.nome || '—'}</div>
                          <div className="text-sm text-slate-700 break-words">{c.whatsapp || '—'}</div>
                          <div className="text-sm text-slate-700 break-words">{c.email || '—'}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">—</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase">Observações</div>
                  <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
                    {observacao ? observacao : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <MainLayout>
      <>
        <Head>
          <title>Morador - AIRE</title>
          <meta name="description" content="Detalhes do morador" />
        </Head>

        {toast ? (
          <div className="fixed top-4 right-4 z-[120] pointer-events-none">
            <div
              className={
                `rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm ` +
                (toast.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/95 border-rose-200 text-rose-800')
              }
            >
              <p className="text-sm font-semibold">{toast.message}</p>
            </div>
          </div>
        ) : null}

        <div className="w-full space-y-6">
          <PageHeader
            title={morador?.nome ? morador.nome : 'Morador'}
            sticky={false}
            backTo="/moradores"
            subtitle={
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100">
                  <Building2 size={12} className="text-blue-600" />
                  {blocoLabel}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
                  <Home size={12} className="text-emerald-600" />
                  {aptLabel}
                </span>
              </div>
            }
            actions={
              <button
                onClick={salvar}
                disabled={saving || loading || !morador}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white
                         bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar
              </button>
            }
          />

          {error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="py-10 text-center">
              <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
              <p className="mt-2 text-gray-500">Carregando morador...</p>
            </div>
          ) : !morador ? null : (
            <>
              <div className="glass-card rounded-2xl overflow-visible">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Users size={20} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Dados do Morador</h2>
                      <p className="text-sm text-gray-500">Edite os campos abaixo</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Facial (foto)</label>
                      <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm p-4">
                        <div className="grid grid-cols-1 gap-4 items-center">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="relative group">
                              <button
                                type="button"
                                className="w-[72px] h-[72px] rounded-2xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shadow-sm cursor-pointer hover:ring-2 hover:ring-sky-500/20 hover:border-sky-300 transition-all"
                                aria-label="Opções de foto"
                              >
                                {facialPreviewUrl || facialUrl ? (
                                  <img src={facialPreviewUrl || facialUrl} alt="Prévia da facial" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                                    <UserPlus size={20} className="text-slate-400" />
                                  </div>
                                )}
                              </button>

                              <div className="hidden group-focus-within:block absolute left-0 top-[calc(100%+10px)] z-[220] w-56">
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                  <div className="px-3 py-2 text-[11px] font-extrabold text-slate-600 bg-slate-50/60 border-b border-slate-100">
                                    Atualizar facial
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
                                        setFacialUrl('')
                                        setFacialRemovida(true)
                                      }}
                                      disabled={!facialFile && !facialUrl}
                                      className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-sm text-rose-700 disabled:opacity-50 disabled:hover:bg-rose-50"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-slate-900">Foto para desbloqueio</p>
                              <p className="text-xs text-slate-500 truncate">
                                {facialFile?.name || (facialUrl ? 'Imagem cadastrada.' : 'Use uma foto frontal, com boa iluminação e sem blur.')}
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
                    </div>
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

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp</label>
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Bloco</label>
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
                          <option value="">Sem bloco</option>
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Observação</label>
                    <textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      placeholder="(opcional)"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Criado em</p>
                      <p className="mt-1 font-semibold text-slate-800">{morador.created_at ? new Date(morador.created_at).toLocaleString() : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Atualizado em</p>
                      <p className="mt-1 font-semibold text-slate-800">{morador.updated_at ? new Date(morador.updated_at).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Contatos adicionais</h2>
                      <p className="text-sm text-gray-500">Opcional: para notificação (WhatsApp e/ou email)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setContatosAdicionais((prev) => [...prev, { nome: '', whatsapp: '', email: '' }])
                      }
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
                              onClick={() => setContatosAdicionais((prev) => prev.filter((_, i) => i !== idx))}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-100 transition-colors"
                            >
                              Remover
                            </button>
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
                              <input
                                value={c.whatsapp}
                                onChange={(e) =>
                                  setContatosAdicionais((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, whatsapp: formatWhatsAppBr(e.target.value) } : item
                                    )
                                  )
                                }
                                onBlur={() =>
                                  setContatosAdicionais((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, whatsapp: formatWhatsAppBr(String(item?.whatsapp || '')) }
                                        : item
                                    )
                                  )
                                }
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="(00)0 0000-0000"
                              />
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                            <input
                              value={c.email}
                              onChange={(e) =>
                                setContatosAdicionais((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, email: e.target.value } : item))
                                )
                              }
                              onBlur={() =>
                                setContatosAdicionais((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, email: String(item?.email || '').trim().toLowerCase() } : item
                                  )
                                )
                              }
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="email@dominio.com"
                              inputMode="email"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </>
          )}
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
