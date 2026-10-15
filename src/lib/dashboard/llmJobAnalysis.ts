import {
  extractJson,
  hasOpenRouter,
  openRouterChat,
} from "@/lib/openrouter";
import type { MatchTier } from "@/lib/dashboard/jobMatch";
import type { DashboardJob } from "@/lib/dashboard/types";
import type { RemoteAssess } from "@/lib/dashboard/assessRemotePage";

const CARGO_BATCH = 25;
const REMOTE_BATCH = 12;

type CargoRow = {
  i: number;
  tier: MatchTier;
  why?: string;
};

type RemoteRow = {
  i: number;
  status: "remote" | "hybrid" | "unclear" | "invalid";
  why?: string;
};

function stripHtml(html: string, max = 1400): string {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function asTier(raw: unknown): MatchTier | null {
  const t = String(raw || "")
    .toLowerCase()
    .trim();
  if (t === "exato" || t === "relacionado" || t === "fora") return t;
  return null;
}

/**
 * Reclassifica cargo (exato/relacionado/fora) via LLM barato.
 * Sem API key → devolve jobs intactos.
 */
export async function classifyCargoWithLlm(
  role: string,
  jobs: DashboardJob[]
): Promise<{
  jobs: DashboardJob[];
  usedLlm: boolean;
  error?: string;
  cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  batches: number;
}> {
  if (!hasOpenRouter() || jobs.length === 0) {
    return {
      jobs,
      usedLlm: false,
      cost_usd: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      batches: 0,
    };
  }

  const out = jobs.map((j) => ({ ...j }));
  const errors: string[] = [];
  let cost_usd = 0;
  let prompt_tokens = 0;
  let completion_tokens = 0;
  let batches = 0;

  for (let offset = 0; offset < out.length; offset += CARGO_BATCH) {
    const slice = out.slice(offset, offset + CARGO_BATCH);
    const catalog = slice.map((job, i) => ({
      i,
      title: job.title,
      company: job.company,
      snippet: (job.snippet || "").slice(0, 180),
    }));

    try {
      const chat = await openRouterChat({
        temperature: 0,
        maxTokens: 1600,
        messages: [
          {
            role: "system",
            content:
              "Você classifica vagas de emprego no Brasil. Responda SÓ JSON válido (array).",
          },
          {
            role: "user",
            content: `Cargo buscado pelo candidato: "${role}"

Para cada vaga, classifique o alinhamento do CARGO (não da modalidade remota):
- "exato": título é claramente esse cargo (ou o mesmo cargo com variação mínima)
- "relacionado": sinônimo / função vizinha aceitável (ex.: atendente ↔ atendimento; CS ↔ customer success; suporte ↔ atendimento)
- "fora": outro cargo (ex.: psicólogo, vendedor, designer, DP, quando o buscado é atendimento)

Ignore localização/empresa. Psicólogo clínico NÃO é "atendimento" de CS.

Vagas:
${JSON.stringify(catalog)}

Retorne JSON array: [{"i":0,"tier":"exato"|"relacionado"|"fora","why":"curto"}]`,
          },
        ],
      });
      batches += 1;
      cost_usd += chat.cost_usd;
      prompt_tokens += chat.prompt_tokens;
      completion_tokens += chat.completion_tokens;

      const rows = extractJson<CargoRow[]>(chat.content);
      if (!Array.isArray(rows)) throw new Error("resposta não é array");

      for (const row of rows) {
        const tier = asTier(row.tier);
        if (tier == null) continue;
        const idx = offset + Number(row.i);
        if (!Number.isFinite(idx) || idx < offset || idx >= offset + slice.length) {
          continue;
        }
        out[idx] = {
          ...out[idx],
          match_tier: tier,
          match_reason: row.why
            ? `LLM: ${String(row.why).slice(0, 120)}`
            : "LLM",
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message.slice(0, 160));
    }
  }

  return {
    jobs: out,
    usedLlm: batches > 0 && errors.length < Math.ceil(out.length / CARGO_BATCH),
    error: errors[0],
    cost_usd,
    prompt_tokens,
    completion_tokens,
    batches,
  };
}

/**
 * Classifica modalidade remota a partir do título + trecho da página.
 * Sem API key → null (caller usa regex).
 */
export async function assessRemoteWithLlm(
  jobs: Array<{ job: DashboardJob; pageHtml: string }>
): Promise<{
  map: Map<number, RemoteAssess>;
  cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  batches: number;
} | null> {
  if (!hasOpenRouter() || jobs.length === 0) return null;

  const result = new Map<number, RemoteAssess>();
  let cost_usd = 0;
  let prompt_tokens = 0;
  let completion_tokens = 0;
  let batches = 0;

  for (let offset = 0; offset < jobs.length; offset += REMOTE_BATCH) {
    const slice = jobs.slice(offset, offset + REMOTE_BATCH);
    const catalog = slice.map((entry, i) => ({
      i,
      title: entry.job.title,
      company: entry.job.company,
      location: entry.job.location,
      from_remote_filter: Boolean(entry.job.from_remote_filter),
      page: stripHtml(entry.pageHtml),
    }));

    try {
      const chat = await openRouterChat({
        temperature: 0,
        maxTokens: 1400,
        messages: [
          {
            role: "system",
            content:
              "Você analisa se vagas BR são 100% remotas/home office. Responda SÓ JSON válido (array).",
          },
          {
            role: "user",
            content: `Para cada vaga, classifique a MODALIDADE DE TRABALHO do candidato:

- "remote": 100% remoto / home office / work from home (título ou descrição deixam claro)
- "hybrid": híbrido, presencial, ou exige ir ao escritório
- "unclear": veio de filtro remoto do portal, mas a página não confirma
- "invalid": página vazia, erro, vaga encerrada

IMPORTANTE:
- "atendimento presencial" / "telefone e presencial" como CANAL ao cliente NÃO é modalidade híbrida se o título/descrição dizem home office.
- Se o título tem "home office" ou "remoto" e não há modelo híbrido explícito → "remote".

Vagas:
${JSON.stringify(catalog)}

Retorne JSON array: [{"i":0,"status":"remote"|"hybrid"|"unclear"|"invalid","why":"curto"}]`,
          },
        ],
      });
      batches += 1;
      cost_usd += chat.cost_usd;
      prompt_tokens += chat.prompt_tokens;
      completion_tokens += chat.completion_tokens;

      const rows = extractJson<RemoteRow[]>(chat.content);
      if (!Array.isArray(rows)) continue;

      for (const row of rows) {
        const local = Number(row.i);
        if (!Number.isFinite(local) || local < 0 || local >= slice.length) {
          continue;
        }
        const global = offset + local;
        const why = (row.why || "").slice(0, 160);
        const status = String(row.status || "").toLowerCase();
        if (status === "remote") {
          result.set(global, {
            ok: true,
            reason: why || "LLM: remoto/home office",
          });
        } else if (status === "hybrid") {
          result.set(global, {
            ok: false,
            kind: "false_positive",
            reason: why || "LLM: modalidade híbrida/presencial",
          });
        } else if (status === "invalid") {
          result.set(global, {
            ok: false,
            kind: "invalid_link",
            reason: why || "LLM: página inválida",
          });
        } else {
          result.set(global, {
            ok: false,
            kind: "indeciso",
            reason: why || "LLM: modalidade não clara",
          });
        }
      }
    } catch {
      // batch falhou → caller usa regex nos índices faltantes
    }
  }

  if (result.size === 0) return null;
  return { map: result, cost_usd, prompt_tokens, completion_tokens, batches };
}
