// Cliente API para fazer chamadas às rotas server-side

export async function apiCall<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Auth
export const authApi = {
  login: (email: string, senha: string) =>
    apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),
  
  verify: (usuarioUid: string) =>
    apiCall('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ usuarioUid }),
    }),
}

// Gaveteiros
export const gaveteirosApi = {
  listar: (condominioUid: string) =>
    apiCall(`/api/gaveteiros?condominioUid=${condominioUid}`),
  
  obterResumo: (gaveteiroUid: string) =>
    apiCall(`/api/gaveteiros/${gaveteiroUid}/resumo`),
  
  listarPortas: (gaveteiroUid: string) =>
    apiCall(`/api/gaveteiros/${gaveteiroUid}/portas`),
}

// Moradores
export const moradoresApi = {
  listar: (condominioUid: string) =>
    apiCall(`/api/moradores?condominioUid=${condominioUid}`),
}

// Blocos
export const blocosApi = {
  listar: (condominioUid: string) =>
    apiCall(`/api/blocos?condominioUid=${condominioUid}`),
}

// Apartamentos
export const apartamentosApi = {
  listar: (condominioUid: string, blocoUid?: string) =>
    apiCall(`/api/apartamentos?condominioUid=${condominioUid}${blocoUid ? `&blocoUid=${blocoUid}` : ''}`),
}

// Portas
export const portasApi = {
  ocupar: (params: {
    portaUid: string
    condominioUid: string
    destinatarios: Array<{ bloco: string; apartamento: string; quantidade?: number }>
    usuarioUid?: string
    observacao?: string
  }) =>
    apiCall('/api/portas/ocupar', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  
  liberar: (params: {
    portaUid: string
    condominioUid: string
    senha: string
    usuarioUid?: string
  }) =>
    apiCall('/api/portas/liberar', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  
  cancelar: (params: {
    portaUid: string
    condominioUid: string
    motivo: string
    usuarioUid?: string
  }) =>
    apiCall('/api/portas/cancelar', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  
  listarMovimentacoes: (portaUid: string, limite?: number) =>
    apiCall(`/api/portas/movimentacoes?portaUid=${portaUid}${limite ? `&limite=${limite}` : ''}`),
}
