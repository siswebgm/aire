import { useState } from 'react'
import Head from 'next/head'
import { Building2, CheckCircle2, Loader2, Save, XCircle } from 'lucide-react'

export default function CadastroCondominioPublicoPage() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successUid, setSuccessUid] = useState<string>('')

  const [nome, setNome] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [documento, setDocumento] = useState('')
  const [descricao, setDescricao] = useState('')
  const [senhaMestre, setSenhaMestre] = useState('')
  const [wifiLogin, setWifiLogin] = useState('')
  const [wifiSenha, setWifiSenha] = useState('')
  const [esp32Ip, setEsp32Ip] = useState('192.168.1.76')
  const [storage, setStorage] = useState('')

  const salvar = async () => {
    setError('')
    setSuccessUid('')

    if (!nome.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/public/cadastrar-condominio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          nome_fantasia: nomeFantasia,
          documento,
          descricao,
          senha_mestre: senhaMestre,
          wifi_login: wifiLogin,
          wifi_senha: wifiSenha,
          esp32_ip: esp32Ip,
          storage
        })
      })

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Erro ao cadastrar')
      }

      setSuccessUid(String(data?.condominio?.uid || ''))
      setNome('')
      setNomeFantasia('')
      setDocumento('')
      setDescricao('')
      setSenhaMestre('')
      setWifiLogin('')
      setWifiSenha('')
      setEsp32Ip('192.168.1.76')
      setStorage('')
    } catch (e: any) {
      setError(e?.message || 'Erro ao cadastrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>Cadastrar Condomínio</title>
        <meta name="description" content="Cadastro público de condomínio" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/20 flex-shrink-0">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">Cadastro de Condomínio</h1>
                <p className="mt-0.5 text-sm text-slate-500 truncate">Crie um novo condomínio</p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-6">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                  <XCircle size={18} className="text-rose-700" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-slate-900">Não foi possível cadastrar</p>
                  <p className="mt-1 text-sm text-rose-700">{error}</p>
                </div>
              </div>
            </div>
          ) : null}

          {successUid ? (
            <div className="bg-white rounded-2xl border border-emerald-200 p-6">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={18} className="text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-900">Condomínio criado com sucesso</p>
                  <p className="mt-1 text-sm text-slate-600 break-words">UID: <span className="font-semibold">{successUid}</span></p>
                  <p className="mt-2 text-xs text-slate-500">Guarde esse UID. Ele será usado para cadastrar blocos/apartamentos/portas.</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
            <div className="p-6 border-b border-slate-100">
              <p className="text-sm text-slate-600">Preencha os dados do condomínio. Campos marcados com * são obrigatórios.</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome *</label>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="Nome do condomínio"
                    disabled={saving}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome fantasia</label>
                  <input
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="Opcional"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Documento</label>
                  <input
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="CNPJ/CPF (opcional)"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Storage (bucket)</label>
                  <input
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="Ex: aire-storage"
                    disabled={saving}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="Opcional"
                    rows={3}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Senha mestre</label>
                  <input
                    value={senhaMestre}
                    onChange={(e) => setSenhaMestre(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="Opcional"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">ESP32 IP</label>
                  <input
                    value={esp32Ip}
                    onChange={(e) => setEsp32Ip(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="192.168.1.76"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">WiFi login</label>
                  <input
                    value={wifiLogin}
                    onChange={(e) => setWifiLogin(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="Opcional"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">WiFi senha</label>
                  <input
                    value={wifiSenha}
                    onChange={(e) => setWifiSenha(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="Opcional"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-6 border-t border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl font-extrabold text-white
                  bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 shadow-md disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
