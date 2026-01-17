import crypto from 'crypto'

export type PublicCadastroMoradorTokenPayload = {
  condominioUid: string
  exp: number
}

const base64UrlEncode = (buf: Buffer) =>
  buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const base64UrlDecode = (value: string) => {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64
  return Buffer.from(padded, 'base64')
}

const getSecret = () => {
  const secret = process.env.PUBLIC_MORADOR_LINK_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('Missing PUBLIC_MORADOR_LINK_SECRET (or NEXTAUTH_SECRET)')
  }
  return secret
}

export function createPublicCadastroMoradorToken(condominioUid: string, expiresInMinutes = 60 * 24 * 7) {
  const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60
  const payload: PublicCadastroMoradorTokenPayload = { condominioUid, exp }
  const payloadJson = JSON.stringify(payload)
  const payloadEnc = base64UrlEncode(Buffer.from(payloadJson, 'utf8'))
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadEnc).digest()
  const sigEnc = base64UrlEncode(sig)
  return `${payloadEnc}.${sigEnc}`
}

export function verifyPublicCadastroMoradorToken(token: string): PublicCadastroMoradorTokenPayload {
  const [payloadEnc, sigEnc] = (token || '').split('.')
  if (!payloadEnc || !sigEnc) throw new Error('Token inválido')

  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadEnc).digest()
  const expectedEnc = base64UrlEncode(expectedSig)

  const a = Buffer.from(expectedEnc)
  const b = Buffer.from(sigEnc)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Token inválido')
  }

  const payloadRaw = base64UrlDecode(payloadEnc).toString('utf8')
  const payload = JSON.parse(payloadRaw) as PublicCadastroMoradorTokenPayload
  if (!payload?.condominioUid || !payload?.exp) throw new Error('Token inválido')

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) throw new Error('Token expirado')

  return payload
}
