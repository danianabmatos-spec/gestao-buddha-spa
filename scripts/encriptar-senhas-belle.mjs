// Converte as senhas do Belle no .env.local de texto puro para AES-256-GCM.
// - Gera BELLE_ENC_KEY (32 bytes) se ainda não existir.
// - Criptografa todo BELLE_*_PASSWORD que ainda não estiver no formato enc:v1:...
// - Faz backup em .env.local.bak antes de escrever.
// Idempotente: rodar de novo não re-encripta o que já está encriptado.
//
// Uso:  node scripts/encriptar-senhas-belle.mjs

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const PREFIX = 'enc:v1:'
const ENV_PATH = path.join(process.cwd(), '.env.local')

function encrypt(plain, keyB64) {
  const key = Buffer.from(keyB64, 'base64')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

if (!fs.existsSync(ENV_PATH)) {
  console.error('.env.local não encontrado em', ENV_PATH); process.exit(1)
}

const original = fs.readFileSync(ENV_PATH, 'utf8')
const lines = original.split(/\r?\n/)

// Descobre (ou cria) a chave
let keyB64 = null
for (const l of lines) {
  const m = l.match(/^\s*BELLE_ENC_KEY\s*=\s*(.+)\s*$/)
  if (m) { keyB64 = m[1].trim(); break }
}
let keyCriada = false
if (!keyB64) {
  keyB64 = crypto.randomBytes(32).toString('base64')
  keyCriada = true
}

let encriptadas = 0
let jaEncriptadas = 0
const out = lines.map((line) => {
  const m = line.match(/^(\s*BELLE_[A-Z0-9_]*_PASSWORD\s*=\s*)(.*)$/)
  if (!m) return line
  const prefixo = m[1]
  const valor = m[2].trim()
  if (!valor) return line
  if (valor.startsWith(PREFIX)) { jaEncriptadas++; return line }
  encriptadas++
  return prefixo + encrypt(valor, keyB64)
})

let novoConteudo = out.join('\n')
if (keyCriada) {
  novoConteudo += `\n# Chave de criptografia das credenciais Belle (Fase 1.5)\nBELLE_ENC_KEY=${keyB64}\n`
}

// Backup + escrita
fs.writeFileSync(ENV_PATH + '.bak', original, 'utf8')
fs.writeFileSync(ENV_PATH, novoConteudo, 'utf8')

console.log('✔ Backup salvo em .env.local.bak')
if (keyCriada) console.log('✔ BELLE_ENC_KEY gerada e adicionada ao .env.local')
else console.log('• BELLE_ENC_KEY já existia — reutilizada')
console.log(`✔ Senhas criptografadas agora: ${encriptadas}`)
if (jaEncriptadas) console.log(`• Já estavam criptografadas: ${jaEncriptadas}`)
console.log('\n⚠️  Sem a BELLE_ENC_KEY as senhas não podem ser lidas. Guarde-a no deploy da VPS.')
