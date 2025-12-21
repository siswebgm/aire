// Tipos baseados nas tabelas do schema gaveteiro

export type StatusPorta = 'DISPONIVEL' | 'OCUPADO' | 'AGUARDANDO_RETIRADA' | 'BAIXADO'

export type PerfilUsuario = 'ADMIN' | 'OPERADOR' | 'CLIENTE' | 'KIOSK'

export type TipoMorador = 'PROPRIETARIO' | 'INQUILINO'

export interface ContatoAdicional {
  nome: string
  whatsapp: string
}

export interface Condominio {
  uid: string
  nome: string
  documento?: string
  descricao?: string
  ativo: boolean
  created_at: string
  senha_mestre?: string
}

export interface Gaveteiro {
  uid: string
  condominio_uid: string
  nome: string
  codigo_hardware: string
  descricao?: string
  ativo: boolean
  created_at: string
  // Campos ESP32
  esp32_ip?: string
  esp32_token?: string
  // Campo calculado (não vem do banco)
  resumo_portas?: ResumoPortas
}

export interface Porta {
  uid: string
  condominio_uid: string
  gaveteiro_uid: string
  numero_porta: number
  status_atual: StatusPorta
  ocupado_em?: string
  finalizado_em?: string
  ultimo_evento_em: string
  cliente_uid?: string
  ativo: boolean
  // Campos para identificar o ocupante atual
  bloco_atual?: string
  apartamento_atual?: string
  compartilhada?: boolean
  // Status físico da fechadura e sensor
  fechadura_status?: 'aberta' | 'fechada'
  sensor_status?: 'aberto' | 'fechado' | 'desconhecido'
  status_fisico_atualizado_em?: string
  // Sensor do ímã (magnético)
  sensor_ima_status?: 'aberto' | 'fechado' | 'desconhecido'
  sensor_ima_atualizado_em?: string
}

// Senha provisória por destinatário
export interface SenhaProvisoria {
  uid: string
  porta_uid: string
  condominio_uid: string
  bloco: string
  apartamento: string
  senha: string
  status: 'ATIVA' | 'USADA' | 'CANCELADA'
  usada_em?: string
  usada_por?: string
  created_at: string
}

export interface MovimentacaoPorta {
  uid: string
  condominio_uid: string
  porta_uid: string
  usuario_uid?: string
  acao: string
  status_resultante: string
  timestamp: string
  origem?: string
  observacao?: string
  bloco?: string
  apartamento?: string
  compartilhada?: boolean
}

export interface ResumoPortas {
  disponivel: number
  ocupado: number
  aguardando_retirada: number
  baixado: number
  total: number
}

export interface Usuario {
  uid: string
  condominio_uid: string
  email: string
  senha_hash?: string // Nunca retornar em queries normais
  nome: string
  telefone?: string
  documento?: string
  perfil: PerfilUsuario
  ativo: boolean
  ultimo_acesso?: string
  created_at: string
  updated_at: string
}

export interface Morador {
  uid: string
  condominio_uid: string
  nome: string
  whatsapp?: string
  bloco?: string
  apartamento: string
  tipo: TipoMorador
  contatos_adicionais: ContatoAdicional[]
  observacao?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Bloco {
  uid: string
  condominio_uid: string
  nome: string
  descricao?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Apartamento {
  uid: string
  condominio_uid: string
  bloco_uid?: string
  numero: string
  andar?: number
  descricao?: string
  ativo: boolean
  created_at: string
  updated_at: string
  // Join
  bloco?: Bloco
}
