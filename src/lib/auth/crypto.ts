import crypto from 'node:crypto'

// Criptografia simétrica AES-256-GCM para segredos em repouso (senhas do Belle).
// Chave em BELLE_ENC_KEY (32 bytes em base64). Só roda em runtime node.
//
// Formato do token: enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>

const PREFIX = 'enc:v1:'

function getKey(): Buffer {
  const raw = process.env.BELLE_ENC_KEY
  if (!raw) throw new Error('BELLE_ENC_KEY não definido no ambiente')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('BELLE_ENC_KEY deve ter 32 bytes (base64)')
  return key
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

export function decrypt(token: string): string {
  if (!isEncrypted(token)) return token // valor ainda em texto puro → retorna como está
  const [ivB64, tagB64, ctB64] = token.slice(PREFIX.length).split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}

/** Decripta se estiver no formato enc:; caso contrário devolve o valor original. */
export function maybeDecrypt(value: string | undefined | null): string {
  if (!value) return ''
  return isEncrypted(value) ? decrypt(value) : value
}
