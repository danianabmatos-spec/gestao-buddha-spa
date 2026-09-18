// Casamento do nome do profissional (como vem do Belle) → Terapeuta cadastrada.
// Réplica das regras usadas no app Folha, pra os dois casarem o MESMO profissional.

export function normalizeNome(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toksNome(s: string): string[] {
  return normalizeNome(s).split(' ').filter((w) => w.length >= 3)
}

// (1) nomeBelle exato → (2) nome exato → (3) tokens (1º nome igual + ≥2 tokens + ratio ≥ 0.5),
// com match ÚNICO. Retorna a terapeuta casada ou null (nenhuma ou ambígua).
export function casarNome<T extends { nome: string; nomeBelle?: string | null }>(
  nomeProf: string,
  pool: T[],
): T | null {
  const n = normalizeNome(nomeProf)

  const porBelle = pool.find((t) => t.nomeBelle && normalizeNome(t.nomeBelle) === n)
  if (porBelle) return porBelle

  const exato = pool.find((t) => normalizeNome(t.nome) === n)
  if (exato) return exato

  const tkAt = toksNome(nomeProf)
  if (tkAt.length === 0) return null

  const candidatos = pool.filter((t) => {
    const tk = toksNome(t.nome)
    if (tk.length === 0) return false
    const shared = tkAt.filter((w) => tk.includes(w)).length
    const ratio = shared / Math.max(tkAt.length, tk.length)
    return tkAt[0] === tk[0] && shared >= 2 && ratio >= 0.5
  })
  return candidatos.length === 1 ? candidatos[0] : null
}
