// Recorta só a flor de lótus da logo oficial e gera PRÉVIAS do ícone em 3 fundos.
// Uso: node scripts/preview-icones.mjs <origem.png> <pastaSaida>
import sharp from 'sharp'
import path from 'node:path'

const SRC = process.argv[2]
const OUT = process.argv[3]
const SIZE = 512

const meta = await sharp(SRC).metadata()
// A flor ocupa a metade de cima; o texto "BUDDHA SPA" fica embaixo. Recorta o topo e apara o branco.
const flor = await sharp(SRC)
  .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.58) })
  .trim({ threshold: 12 })
  .toBuffer()

// Redimensiona a flor pra ocupar ~76% do ícone, com margem de respiro.
const alvo = Math.round(SIZE * 0.76)
const florRedim = await sharp(flor).resize(alvo, alvo, { fit: 'inside' }).png().toBuffer()

const fundos = [
  { nome: 'marsala', bg: { r: 0x7e, g: 0x00, b: 0x00, alpha: 1 } },
  { nome: 'offwhite', bg: { r: 0xe4, g: 0xe5, b: 0xe2, alpha: 1 } },
  { nome: 'transparente', bg: { r: 0, g: 0, b: 0, alpha: 0 } },
]

for (const f of fundos) {
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: f.bg } })
    .composite([{ input: florRedim, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, `preview-${f.nome}.png`))
  console.log('✔ preview-' + f.nome + '.png')
}
process.exit(0)
