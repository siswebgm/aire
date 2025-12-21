import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Usuario, Condominio } from '../types/gaveteiro'

interface AuthContextType {
  usuario: Usuario | null
  condominio: Condominio | null
  loading: boolean
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [loading, setLoading] = useState(true)

  // Verificar sessão ao carregar e revalidar usuário e condomínio
  useEffect(() => {
    const verificarSessao = async () => {
      const savedUser = localStorage.getItem('gvt_usuario')
      const savedCondominio = localStorage.getItem('gvt_condominio')
      
      if (savedUser && savedCondominio) {
        const user = JSON.parse(savedUser)
        
        // Buscar dados ATUALIZADOS do usuário no banco (perfil pode ter mudado)
        const { data: usuarioAtualizado, error: userError } = await supabase
          .from('gvt_usuarios')
          .select('*')
          .eq('uid', user.uid)
          .eq('ativo', true)
          .single()
        
        if (!userError && usuarioAtualizado) {
          setUsuario(usuarioAtualizado)
          localStorage.setItem('gvt_usuario', JSON.stringify(usuarioAtualizado))
        } else {
          setUsuario(user)
        }
        
        // Buscar dados atualizados do condomínio no banco
        const { data: condominioAtualizado, error } = await supabase
          .from('gvt_condominios')
          .select('*')
          .eq('uid', user.condominio_uid)
          .single()
        
        if (!error && condominioAtualizado) {
          setCondominio(condominioAtualizado)
          localStorage.setItem('gvt_condominio', JSON.stringify(condominioAtualizado))
        } else {
          setCondominio(JSON.parse(savedCondominio))
        }
      }
      setLoading(false)
    }
    
    verificarSessao()
  }, [])

  const login = async (email: string, senha: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Buscar usuário pelo email
      const { data: usuarios, error } = await supabase
        .from('gvt_usuarios')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('ativo', true)
        .limit(1)

      if (error) {
        console.error('Erro ao buscar usuário:', error)
        return { success: false, error: 'Erro ao conectar com o servidor' }
      }

      if (!usuarios || usuarios.length === 0) {
        return { success: false, error: 'Email não encontrado' }
      }

      const user = usuarios[0] as Usuario

      // NOTA: Em produção, usar bcrypt para comparar senhas!
      // Por simplicidade, comparamos diretamente (NÃO FAZER EM PRODUÇÃO)
      // A senha no banco deve estar em texto simples para este teste
      if (user.senha_hash !== senha) {
        return { success: false, error: 'Senha incorreta' }
      }

      // Buscar dados do condomínio
      const { data: condominioData, error: condError } = await supabase
        .from('gvt_condominios')
        .select('*')
        .eq('uid', user.condominio_uid)
        .single()

      if (condError || !condominioData) {
        return { success: false, error: 'Erro ao carregar dados do condomínio' }
      }

      // Atualizar último acesso
      await supabase
        .from('gvt_usuarios')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('uid', user.uid)

      // Salvar na sessão
      const userWithoutPassword = { ...user, senha_hash: undefined }
      setUsuario(userWithoutPassword)
      setCondominio(condominioData)
      
      localStorage.setItem('gvt_usuario', JSON.stringify(userWithoutPassword))
      localStorage.setItem('gvt_condominio', JSON.stringify(condominioData))

      return { success: true }

    } catch (err) {
      console.error('Erro no login:', err)
      return { success: false, error: 'Erro inesperado' }
    }
  }

  const logout = () => {
    setUsuario(null)
    setCondominio(null)
    localStorage.removeItem('gvt_usuario')
    localStorage.removeItem('gvt_condominio')
  }

  return (
    <AuthContext.Provider value={{ usuario, condominio, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
