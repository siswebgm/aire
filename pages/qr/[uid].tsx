import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import QRCode from 'react-qr-code'
import { supabase } from '../../src/lib/supabaseClient'

interface SenhaData {
  uid: string
  senha: string
  bloco: string
  apartamento: string
  status: string
  porta_uid: string
  condominio_uid: string
  qrcode_data: string | null
}

export default function QrCodePage() {
  const router = useRouter()
  const { uid } = router.query
  const [senhaData, setSenhaData] = useState<SenhaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [condominioNome, setCondominioNome] = useState('')
  const [numeroPorta, setNumeroPorta] = useState<number | null>(null)

  useEffect(() => {
    if (!uid || typeof uid !== 'string') return
    carregarDados(uid)
  }, [uid])

  const carregarDados = async (senhaUid: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('gvt_senhas_provisorias')
        .select('uid, senha, bloco, apartamento, status, porta_uid, condominio_uid, qrcode_data')
        .eq('uid', senhaUid)
        .single()

      if (error || !data) {
        setErro('QR Code não encontrado ou expirado')
        return
      }

      setSenhaData(data as SenhaData)

      // Buscar nome do condomínio
      const { data: cond } = await supabase
        .from('gvt_condominios')
        .select('nome')
        .eq('uid', data.condominio_uid)
        .single()
      if (cond) setCondominioNome((cond as any).nome || '')

      // Buscar número da porta
      const { data: porta } = await supabase
        .from('gvt_portas')
        .select('numero_porta')
        .eq('uid', data.porta_uid)
        .single()
      if (porta) setNumeroPorta((porta as any).numero_porta || null)
    } catch (err) {
      setErro('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  // Payload do QR Code (o que será escaneado no totem para retirar)
  const qrPayload = senhaData?.qrcode_data || (senhaData ? JSON.stringify({
    c: senhaData.condominio_uid,
    p: senhaData.porta_uid,
    s: senhaData.senha,
    b: senhaData.bloco,
    a: senhaData.apartamento
  }) : '')

  const senhaUsada = senhaData?.status === 'USADA'
  const senhaCancelada = senhaData?.status === 'CANCELADA'
  const senhaAtiva = senhaData?.status === 'ATIVA'

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white/60 font-semibold animate-pulse">Carregando...</div>
      </div>
    )
  }

  if (erro || !senhaData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <div className="text-xl font-extrabold text-white">{erro || 'Não encontrado'}</div>
          <div className="text-sm text-white/40 mt-2">Verifique o link e tente novamente</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        {condominioNome && (
          <div className="text-center mb-6">
            <div className="text-xs font-bold tracking-[0.2em] text-white/30 uppercase">{condominioNome}</div>
          </div>
        )}

        {/* Card principal */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 flex flex-col items-center">

          {/* Status */}
          {senhaCancelada && (
            <div className="w-full mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-center">
              <div className="text-sm font-bold text-rose-400">Senha cancelada</div>
            </div>
          )}
          {senhaUsada && (
            <div className="w-full mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-center">
              <div className="text-sm font-bold text-amber-400">Encomenda já retirada</div>
            </div>
          )}

          {/* QR Code */}
          {senhaAtiva && (
            <div className="bg-white rounded-2xl p-4 mb-5">
              <QRCode value={qrPayload} size={200} level="H" />
            </div>
          )}

          {/* Info da encomenda */}
          <div className="text-center mb-4">
            <div className="text-lg font-extrabold text-white">Sua encomenda chegou!</div>
            <div className="text-sm text-white/50 mt-1">
              Bloco {senhaData.bloco} • Apto {senhaData.apartamento}
            </div>
          </div>

          {/* Senha numérica */}
          {senhaAtiva && (
            <div className="w-full rounded-xl bg-white/10 p-4 text-center mb-4">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">Senha de retirada</div>
              <div className="text-3xl font-black text-emerald-400 tracking-[0.3em]">{senhaData.senha}</div>
            </div>
          )}

          {/* Compartimento */}
          {numeroPorta && (
            <div className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Compartimento</div>
              <div className="text-xl font-extrabold text-white">{numeroPorta}</div>
            </div>
          )}

          {/* Instrução */}
          {senhaAtiva && (
            <div className="text-xs text-white/30 text-center mt-4 leading-relaxed">
              Apresente este QR Code ou digite a senha no painel do condomínio para retirar sua encomenda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
