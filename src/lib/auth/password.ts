import bcrypt from 'bcryptjs'

// Hash/verificação de senha (bcrypt, mesmo padrão do LeadFlow).
// Usado apenas em runtime node (login e seed) — nunca no middleware edge.

const ROUNDS = 10

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, ROUNDS)
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}
