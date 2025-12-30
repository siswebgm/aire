import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente Supabase não configuradas')
}

// Cliente Supabase - usando schema cobrancas (onde as tabelas realmente existem)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'cobrancas'
  },
  global: {
    headers: {
      'Accept-Profile': 'cobrancas',
      'Content-Profile': 'cobrancas'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
