import { TokenService } from './token.service'

export interface ESPStatusResponse {
  portas: Array<{
    porta: number
    estado: 'aberta' | 'fechada'
    sensor: 'aberto' | 'fechado' | 'indefinido'
  }>
}

export interface ESPAberturaRequest {
  porta: number
  uid: string
  token: string
}

export class ESPService {
  // Enviar comando de abertura para o ESP32
  static async abrirPorta(
    espIP: string,
    portaUid: string,
    numeroPorta: number,
    secret: string
  ): Promise<{ sucesso: boolean; erro?: string }> {
    try {
      // Gerar token de autenticação
      const token = TokenService.gerarTokenESP(portaUid, numeroPorta, secret)

      // Construir URL do endpoint
      const url = `http://${espIP}/abrir`
      
      // Enviar requisição POST para o ESP
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          porta: numeroPorta.toString(),
          uid: portaUid,
          token: token
        }),
        signal: AbortSignal.timeout(10000) // Timeout de 10 segundos
      })

      if (!response.ok) {
        throw new Error(`ESP retornou status ${response.status}`)
      }

      const resultado = await response.json()
      
      // Verificar resposta do ESP
      if (!resultado.ok) {
        throw new Error('ESP não conseguiu abrir a porta')
      }

      console.log(`Porta ${numeroPorta} aberta com sucesso no ESP ${espIP}`)
      return { sucesso: true }

    } catch (error) {
      console.error(`Erro ao comunicar com ESP ${espIP}:`, error)
      
      let mensagemErro = 'Erro de comunicação com o ESP32'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          mensagemErro = 'Timeout na comunicação com o ESP32'
        } else if (error.message.includes('ECONNREFUSED')) {
          mensagemErro = 'ESP32 não encontrado na rede'
        } else if (error.message.includes('ENOTFOUND')) {
          mensagemErro = 'IP do ESP32 inválido'
        } else {
          mensagemErro = error.message
        }
      }

      return { sucesso: false, erro: mensagemErro }
    }
  }

  // Enviar comando de fechamento para o ESP32 (opcional)
  static async fecharPorta(
    espIP: string,
    portaUid: string,
    numeroPorta: number,
    secret: string
  ): Promise<{ sucesso: boolean; erro?: string }> {
    try {
      const token = TokenService.gerarTokenESP(portaUid, numeroPorta, secret)
      const url = `http://${espIP}/fechar`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          porta: numeroPorta.toString(),
          uid: portaUid,
          token: token
        }),
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        throw new Error(`ESP retornou status ${response.status}`)
      }

      const resultado = await response.json()
      
      if (!resultado.ok) {
        throw new Error('ESP não conseguiu fechar a porta')
      }

      console.log(`Porta ${numeroPorta} fechada com sucesso no ESP ${espIP}`)
      return { sucesso: true }

    } catch (error) {
      console.error(`Erro ao fechar porta no ESP ${espIP}:`, error)
      
      let mensagemErro = 'Erro ao fechar porta no ESP32'
      
      if (error instanceof Error) {
        mensagemErro = error.message
      }

      return { sucesso: false, erro: mensagemErro }
    }
  }

  // Consultar status das portas no ESP32 (para diagnóstico)
  static async consultarStatus(espIP: string): Promise<{ sucesso: boolean; dados?: ESPStatusResponse; erro?: string }> {
    try {
      const url = `http://${espIP}/status`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.AIRE_ESP_SECRET}`
        },
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`ESP retornou status ${response.status}`)
      }

      const dados = await response.json()
      return { sucesso: true, dados }

    } catch (error) {
      console.error(`Erro ao consultar status do ESP ${espIP}:`, error)
      
      let mensagemErro = 'Erro ao consultar status do ESP32'
      
      if (error instanceof Error) {
        mensagemErro = error.message
      }

      return { sucesso: false, erro: mensagemErro }
    }
  }

  // Testar conectividade com o ESP32
  static async testarConectividade(espIP: string): Promise<{ online: boolean; latenciaMs?: number; erro?: string }> {
    const inicio = Date.now()
    
    try {
      const url = `http://${espIP}/status`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.AIRE_ESP_SECRET}`
        },
        signal: AbortSignal.timeout(3000)
      })

      if (!response.ok) {
        throw new Error(`Status ${response.status}`)
      }

      const latencia = Date.now() - inicio
      return { online: true, latenciaMs: latencia }

    } catch (error) {
      const latencia = Date.now() - inicio
      
      let mensagemErro = 'ESP32 offline'
      if (error instanceof Error) {
        mensagemErro = error.message
      }

      return { online: false, latenciaMs: latencia, erro: mensagemErro }
    }
  }
}
