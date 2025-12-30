import crypto from 'crypto'

export class TokenService {
  // Gerar token SHA256 para autenticação com ESP32
  static gerarTokenESP(portaUid: string, numeroPorta: number, secret: string): string {
    const payload = `${portaUid}:${numeroPorta}:${secret}`
    return crypto.createHash('sha256').update(payload).digest('hex')
  }

  // Validar token SHA256 (usado pelo ESP32)
  static validarTokenESP(
    portaUid: string,
    numeroPorta: number,
    tokenRecebido: string,
    secret: string
  ): boolean {
    const tokenEsperado = this.gerarTokenESP(portaUid, numeroPorta, secret)
    return tokenEsperado === tokenRecebido
  }

  // Gerar token de sessão para frontend (opcional)
  static gerarTokenSessao(usuarioUid: string, duracaoMinutos: number = 30): string {
    const expiracao = Math.floor(Date.now() / 1000) + (duracaoMinutos * 60)
    const payload = `${usuarioUid}:${expiracao}:${process.env.NEXTAUTH_SECRET}`
    return crypto.createHash('sha256').update(payload).digest('hex')
  }

  // Validar token de sessão
  static validarTokenSessao(usuarioUid: string, token: string): boolean {
    const payload = `${usuarioUid}:${process.env.NEXTAUTH_SECRET}`
    const tokenEsperado = crypto.createHash('sha256').update(payload).digest('hex')
    return tokenEsperado === token
  }
}
