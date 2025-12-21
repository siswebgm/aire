import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://seu-projeto.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sua-anon-key'

// Cliente Supabase - usando schema cobrancas (já exposto no PostgREST)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'cobrancas'
  },
  global: {
    headers: {
      'Accept-Profile': 'cobrancas',
      'Content-Profile': 'cobrancas'
    }
  }
})
