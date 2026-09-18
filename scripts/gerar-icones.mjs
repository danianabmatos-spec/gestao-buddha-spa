// Gera os ícones do app (PWA + apple-touch) a partir da LOGO OFICIAL Buddha Spa.
// Recorta só a flor de lótus dourada e compõe sobre fundo marsala.
// Uso: node scripts/gerar-icones.mjs
import sharp from 'sharp'
import path from 'node:path'

const SRC = 'C:/Users/MADISHAR/OneDrive/Documentos/1. Buddha Spa/13. Marketing/NOVA LOGO BUDDHA SPA.png'
const OUT = path.join(process.cwd(), 'public')
const MARSALA = { r: 0x7e, g: 0x00, b: 0x00, alpha: 1 }

// Recorta o topo da logo (a flor) e apara o branco em volta.
const meta = await sharp(SRC).metadata()
const flor = await sharp(SRC)
  .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.58) })
  .trim({ threshold: 12 })
  .toBuffer()

const alvos = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
]

for (const a of alvos) {
  const florRedim = await sharp(flor)
    .resize(Math.round(a.size * 0.98), Math.round(a.size * 0.98), { fit: 'inside' })
    .png()
    .toBuffer()
  await sharp({ create: { width: a.size, height: a.size, channels: 4, background: MARSALA } })
    .composite([{ input: florRedim, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, a.file))
  console.log('✔', a.file, `(${a.size}x${a.size})`)
}
process.exit(0)
