/**
 * Cliente mínimo OpenRouter (OpenAI-compatible).
 * Modelo padrão: Gemini 2.5 Flash Lite (~US$ 0,10 / M tokens in).
 */

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

export async function openRouterChat(input: {
  messages: OpenRouterMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
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
    };
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    if (!content) throw new Error("OpenRouter: resposta vazia");
    return content;
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
