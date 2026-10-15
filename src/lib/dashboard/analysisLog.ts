/** Log de etapas da análise admin (tempo + custo estimado de API). */

export type AnalysisLogStep = {
  id: string;
  label: string;
  ms: number;
  ok: boolean;
  detail?: string;
  /** Custo estimado em USD (OpenRouter real/estimado; Bee por créditos). */
  cost_usd?: number;
  meta?: Record<string, string | number | boolean | null>;
};

export type AnalysisLog = {
  steps: AnalysisLogStep[];
  total_ms: number;
  total_cost_usd: number;
  started_at: string;
  finished_at: string;
};

/** ScrapingBee stealth + JS ≈ 75 créditos (teste Jooble). */
export const BEE_STEALTH_JS_CREDITS = 75;
/** ScrapingBee premium + JS ≈ 25 créditos (Indeed etc.). */
export const BEE_PREMIUM_JS_CREDITS = 25;

export function beeCreditUsd(credits: number): number {
  const per =
    Number(process.env.SCRAPINGBEE_USD_PER_CREDIT) || 0.0002;
  return credits * per;
}

export function openRouterTokenUsd(
  promptTokens: number,
  completionTokens: number
): number {
  const inPerM = Number(process.env.OPENROUTER_USD_PER_M_IN) || 0.1;
  const outPerM = Number(process.env.OPENROUTER_USD_PER_M_OUT) || 0.4;
  return (promptTokens / 1e6) * inPerM + (completionTokens / 1e6) * outPerM;
}

export class AnalysisLogBuilder {
  private steps: AnalysisLogStep[] = [];
  private startedAt = new Date();
  private t0 = Date.now();

  async timed<T>(
    id: string,
    label: string,
    fn: () => Promise<T>,
    after?: (result: T, ms: number) => Partial<AnalysisLogStep>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const ms = Date.now() - start;
      const extra = after?.(result, ms) || {};
      this.steps.push({
        id,
        label,
        ms,
        ok: extra.ok !== false,
        detail: extra.detail,
        cost_usd: extra.cost_usd,
        meta: extra.meta,
      });
      return result;
    } catch (err) {
      const ms = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      this.steps.push({
        id,
        label,
        ms,
        ok: false,
        detail: message.slice(0, 200),
      });
      throw err;
    }
  }

  add(step: AnalysisLogStep) {
    this.steps.push(step);
  }

  build(): AnalysisLog {
    const finished = new Date();
    const total_cost_usd = this.steps.reduce(
      (s, x) => s + (typeof x.cost_usd === "number" ? x.cost_usd : 0),
      0
    );
    return {
      steps: this.steps,
      total_ms: Date.now() - this.t0,
      total_cost_usd: Math.round(total_cost_usd * 1e6) / 1e6,
      started_at: this.startedAt.toISOString(),
      finished_at: finished.toISOString(),
    };
  }
}

export function formatUsd(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.001) return `$${n.toFixed(5)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
