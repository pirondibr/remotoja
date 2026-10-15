/**
 * Cliente mínimo OpenRouter (OpenAI-compatible).
 * Modelo padrão: Gemini 2.5 Flash Lite (~US$ 0,10 / M tokens in).
 */

import { openRouterTokenUsd } from "@/lib/dashboard/analysisLog";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function getOpenRouterApiKey(): string {
  return process.env.OPENROUTER_API_KEY?.trim() || "";
}

export function hasOpenRouter(): boolean {
  return Boolean(getOpenRouterApiKey());
}

export function getOpenRouterModel(): string {
  return (
    process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash-lite"
  );
}

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterChatResult = {
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  model: string;
};

export async function openRouterChat(input: {
  messages: OpenRouterMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<OpenRouterChatResult> {
  const key = getOpenRouterApiKey();
  if (!key) throw new Error("OPENROUTER_API_KEY não configurada");

  const model = input.model || getOpenRouterModel();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 45_000
  );

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL?.trim() ||
          "https://minhavagaremota.com.br",
        "X-Title": "Minha Vaga Remota",
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0,
        max_tokens: input.maxTokens ?? 2000,
        messages: input.messages,
        usage: { include: true },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `OpenRouter ${res.status}: ${body.slice(0, 200) || res.statusText}`
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        cost?: number;
        total_cost?: number;
      };
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    if (!content) throw new Error("OpenRouter: resposta vazia");

    const prompt_tokens = Number(data.usage?.prompt_tokens) || 0;
    const completion_tokens = Number(data.usage?.completion_tokens) || 0;
    const reported =
      typeof data.usage?.cost === "number"
        ? data.usage.cost
        : typeof data.usage?.total_cost === "number"
          ? data.usage.total_cost
          : null;
    const cost_usd =
      reported != null
        ? reported
        : openRouterTokenUsd(prompt_tokens, completion_tokens);

    return {
      content,
      prompt_tokens,
      completion_tokens,
      cost_usd,
      model: data.model || model,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Extrai primeiro array/objeto JSON do texto (modelos às vezes envelopam em ```). */
export function extractJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const startArr = cleaned.indexOf("[");
    const startObj = cleaned.indexOf("{");
    const start =
      startArr >= 0 && (startObj < 0 || startArr < startObj)
        ? startArr
        : startObj;
    if (start < 0) throw new Error("JSON não encontrado na resposta");
    const endArr = cleaned.lastIndexOf("]");
    const endObj = cleaned.lastIndexOf("}");
    const end = Math.max(endArr, endObj);
    if (end <= start) throw new Error("JSON incompleto na resposta");
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}
