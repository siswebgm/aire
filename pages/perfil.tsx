import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { KeyRound, Mail, Phone, Save, User } from 'lucide-react'
import { MainLayout } from '../components/MainLayout'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../src/contexts/AuthContext'
import { supabase } from '../src/lib/supabaseClient'

function formatarTelefone(valor: string) {
  const digits = (valor || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''

  if (digits.length <= 2) return `(${digits}`

  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length === 0) return `(${ddd})`

  if (rest.length <= 4) {
    return `(${ddd})${rest}`
  }

  if (rest.length <= 8) {
    return `(${ddd})${rest.slice(0, 4)}-${rest.slice(4)}`
  }

  return `(${ddd})${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5, 9)}`
}

function normalizarTelefone(valor: string) {
  const digits = (valor || '').replace(/\D/g, '').slice(0, 11)
  return digits.length ? digits : null
}

export default function PerfilPage() {
  const router = useRouter()
  const { usuario, condominio, loading, atualizarUsuario } = useAuth()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const [erroPerfil, setErroPerfil] = useState<string | null>(null)
  const [sucessoPerfil, setSucessoPerfil] = useState<string | null>(null)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [sucessoSenha, setSucessoSenha] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !usuario) {
      router.push('/login')
      return
    }

    if (usuario) {
      setNome(usuario.nome || '')
      setEmail(usuario.email || '')
      setTelefone(formatarTelefone(usuario.telefone || ''))
    }
  }, [usuario, loading, router])

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario) return

    setErroPerfil(null)
    setSucessoPerfil(null)

    const emailNormalizado = email.toLowerCase().trim()
    if (!nome.trim()) {
      setErroPerfil('Informe o nome')
      return
    }
    if (!emailNormalizado) {
      setErroPerfil('Informe o email')
      return
    }

    setSalvandoPerfil(true)
    try {
      const { data, error } = await supabase
        .from('gvt_usuarios')
        .update({
          nome: nome.trim(),
          email: emailNormalizado,
          telefone: normalizarTelefone(telefone)
        })
        .eq('uid', usuario.uid)
        .eq('condominio_uid', usuario.condominio_uid)
        .select('*')
        .single()

      if (error || !data) {
        setErroPerfil(error?.message || 'Erro ao salvar perfil')
        return
      }

      atualizarUsuario(data)
      setSucessoPerfil('Perfil atualizado')
    } catch (err: any) {
      setErroPerfil(err?.message || 'Erro inesperado')
    } finally {
      setSalvandoPerfil(false)
    }
  }

  const alterarSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario) return

    setErroSenha(null)
    setSucessoSenha(null)

    if (!senhaAtual) {
      setErroSenha('Informe a senha atual')
      return
    }
    if (!novaSenha) {
      setErroSenha('Informe a nova senha')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setErroSenha('A confirmação da senha não confere')
      return
    }

    setSalvandoSenha(true)
    try {
      const { data: senhaData, error: senhaError } = await supabase
        .from('gvt_usuarios')
        .select('senha_hash')
        .eq('uid', usuario.uid)
        .eq('condominio_uid', usuario.condominio_uid)
        .eq('ativo', true)
        .single()

      if (senhaError || !senhaData) {
        setErroSenha('Não foi possível validar a senha atual')
        return
      }

      if (senhaData.senha_hash !== senhaAtual) {
        setErroSenha('Senha atual incorreta')
        return
      }

      const { error: updError } = await supabase
        .from('gvt_usuarios')
        .update({ senha_hash: novaSenha })
        .eq('uid', usuario.uid)
        .eq('condominio_uid', usuario.condominio_uid)

      if (updError) {
        setErroSenha(updError.message || 'Erro ao alterar senha')
        return
      }

      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
      setSucessoSenha('Senha atualizada')
    } catch (err: any) {
      setErroSenha(err?.message || 'Erro inesperado')
    } finally {
      setSalvandoSenha(false)
    }
  }

  if (loading || !usuario || !condominio) {
    return null
  }

  return (
    <MainLayout>
      <>
        <Head>
          <title>Meu Perfil - AIRE</title>
        </Head>

        <div className="space-y-6">
          <PageHeader
            title="Meu perfil"
            subtitle={<span className="text-slate-500">Atualize seus dados e senha</span>}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <form onSubmit={salvarPerfil} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2">
                <User size={18} className="text-sky-700" />
                <h2 className="text-base font-extrabold text-slate-900">Dados do usuário</h2>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Nome</span>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-11">
                    <User size={16} className="text-slate-400" />
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
                      placeholder="Seu nome"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Email</span>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-11">
                    <Mail size={16} className="text-slate-400" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
                      placeholder="email@dominio.com"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Telefone</span>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-11">
                    <Phone size={16} className="text-slate-400" />
                    <input
                      value={telefone}
                      onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                      className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
                      inputMode="numeric"
                      placeholder="(00)0 0000-0000"
                    />
                  </div>
                </label>

                {erroPerfil ? <p className="text-sm font-semibold text-red-600">{erroPerfil}</p> : null}
                {sucessoPerfil ? <p className="text-sm font-semibold text-emerald-700">{sucessoPerfil}</p> : null}

                <button
                  type="submit"
                  disabled={salvandoPerfil}
                  className="mt-1 inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 text-white font-extrabold shadow-md hover:shadow-lg transition disabled:opacity-60"
                >
                  <Save size={16} />
                  {salvandoPerfil ? 'Salvando...' : 'Salvar dados'}
                </button>
              </div>
            </form>

            <form onSubmit={alterarSenha} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-sky-700" />
                <h2 className="text-base font-extrabold text-slate-900">Alterar senha</h2>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Senha atual</span>
                  <input
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="mt-1 w-full h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-200/70"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Nova senha</span>
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="mt-1 w-full h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-200/70"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Confirmar nova senha</span>
                  <input
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="mt-1 w-full h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-200/70"
                  />
                </label>

                {erroSenha ? <p className="text-sm font-semibold text-red-600">{erroSenha}</p> : null}
                {sucessoSenha ? <p className="text-sm font-semibold text-emerald-700">{sucessoSenha}</p> : null}

                <button
                  type="submit"
                  disabled={salvandoSenha}
                  className="mt-1 inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-slate-900 text-white font-extrabold shadow-md hover:bg-slate-800 transition disabled:opacity-60"
                >
                  <KeyRound size={16} />
                  {salvandoSenha ? 'Salvando...' : 'Alterar senha'}
                </button>

                <p className="text-xs text-slate-500">
                  A senha é validada conforme o modelo atual do sistema (comparação direta de <code className="font-semibold">senha_hash</code>).
                </p>
              </div>
            </form>
          </div>
        </div>
      </>
    </MainLayout>
  )
}
