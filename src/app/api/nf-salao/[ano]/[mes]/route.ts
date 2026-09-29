import { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth/guard";
import { getCompetencia, listarCompetencias, getEmpresaDaUnidade } from "@/lib/nf-salao/dados";
import { idPorSlug } from "@/lib/nf-salao/unidades";
import {
  abrirCompetencia,
  salvarBase,
  addTerapeuta,
  editTerapeuta,
  removerTerapeuta,
  emitirNota,
  fecharMes,
  reabrirMes,
  puxarDaFolha,
  puxarBaseGestao,
  atribuirRpsTodas,
  definirProximoRps,
} from "@/lib/nf-salao/escrita";

export const dynamic = "force-dynamic";

// Módulo fiscal sensível: só DONA e FINANCEIRO (ambos veem todas as unidades).
async function guard() {
  const session = await getSession();
  if (!session) return { erro: unauthorized() };
  if (session.perfil !== "DONA" && session.perfil !== "FINANCEIRO") {
    return { erro: Response.json({ error: "Acesso restrito" }, { status: 403 }) };
  }
  return { session };
}

function parseAnoMes(ano: string, mes: string) {
  const a = Number(ano),
    m = Number(mes);
  if (!a || !m || m < 1 || m > 12) return null;
  return { a, m };
}

// Unidade vem por query ?unidade=slug (default: piloto Anália). Valida contra as 7 conhecidas.
function resolveUnidade(req: NextRequest): { id: number; slug: string } | { erro: Response } {
  const slug = req.nextUrl.searchParams.get("unidade") || "analia-franco";
  const id = idPorSlug(slug);
  if (!id) return { erro: Response.json({ error: "Unidade inválida" }, { status: 400 }) };
  return { id, slug };
}

// GET /api/nf-salao/2026/8?unidade=slug — competência + meses disponíveis + empresa.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ano: string; mes: string }> },
) {
  const g = await guard();
  if (g.erro) return g.erro;
  const { ano, mes } = await ctx.params;
  const p = parseAnoMes(ano, mes);
  if (!p) return Response.json({ error: "ano/mes inválidos" }, { status: 400 });
  const u = resolveUnidade(req);
  if ("erro" in u) return u.erro;

  try {
    const [competencia, disponiveis, empresa] = await Promise.all([
      getCompetencia(p.a, p.m, u.id),
      listarCompetencias(u.id),
      getEmpresaDaUnidade(u.slug),
    ]);
    return Response.json({ competencia, disponiveis, empresa, unidade: { id: u.id, slug: u.slug } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erro ao carregar" }, { status: 500 });
  }
}

// PATCH /api/nf-salao/2026/9?unidade=slug — edita a base (fatur./reembolso/gympass/tp/avulsas) + alíquotas.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ ano: string; mes: string }> },
) {
  const g = await guard();
  if (g.erro) return g.erro;
  const { ano, mes } = await ctx.params;
  const p = parseAnoMes(ano, mes);
  if (!p) return Response.json({ error: "ano/mes inválidos" }, { status: 400 });
  const u = resolveUnidade(req);
  if ("erro" in u) return u.erro;

  const body = await req.json().catch(() => ({}));
  try {
    const competencia = await salvarBase(p.a, p.m, body, u.id);
    return Response.json({ competencia });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 400 });
  }
}

// POST /api/nf-salao/2026/9?unidade=slug — ações. Body: { acao, ...payload }.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ ano: string; mes: string }> },
) {
  const g = await guard();
  if (g.erro) return g.erro;
  const { ano, mes } = await ctx.params;
  const p = parseAnoMes(ano, mes);
  if (!p) return Response.json({ error: "ano/mes inválidos" }, { status: 400 });
  const u = resolveUnidade(req);
  if ("erro" in u) return u.erro;

  const body = await req.json().catch(() => ({}));
  const acao = body?.acao as string;
  const nome = (g.session as { nome?: string })?.nome ?? null;

  try {
    let competencia;
    switch (acao) {
      case "abrir":
        competencia = await abrirCompetencia(p.a, p.m, u.id);
        break;
      case "fechar":
        competencia = await fecharMes(p.a, p.m, nome, u.id);
        break;
      case "reabrir":
        competencia = await reabrirMes(p.a, p.m, u.id);
        break;
      case "addTerapeuta":
        competencia = await addTerapeuta(p.a, p.m, body.terapeuta ?? {}, u.id);
        break;
      case "editTerapeuta":
        competencia = await editTerapeuta(p.a, p.m, Number(body.id), body.terapeuta ?? {}, u.id);
        break;
      case "removerTerapeuta":
        competencia = await removerTerapeuta(p.a, p.m, Number(body.id), u.id);
        break;
      case "emitir":
        competencia = await emitirNota(p.a, p.m, Number(body.id), {
          nfSalaoNumero: body.nfSalaoNumero,
          codVerificacao: body.codVerificacao,
        }, u.id);
        break;
      case "definirRps":
        await definirProximoRps(Number(body.valor), u.id);
        competencia = await getCompetencia(p.a, p.m, u.id);
        break;
      case "puxarFolha": {
        const r = await puxarDaFolha(p.a, p.m, u.id);
        return Response.json({ competencia: r.competencia, resumo: r.resumo });
      }
      case "puxarBaseGestao": {
        const r = await puxarBaseGestao(p.a, p.m, u.id);
        return Response.json({ competencia: r.competencia, resumoBase: r.resumo });
      }
      case "atribuirRps": {
        const r = await atribuirRpsTodas(p.a, p.m, u.id);
        return Response.json({ competencia: r.competencia, atribuidos: r.atribuidos });
      }
      default:
        return Response.json({ error: "Ação inválida" }, { status: 400 });
    }
    return Response.json({ competencia });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 400 });
  }
}
