"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { FeedConvertV3 } from "@/components/FeedConvertV3";
import { RoleChoiceHint } from "@/components/RoleChoiceHint";
import {
  captureAttributionFromUrl,
  loadAttribution,
} from "@/lib/attribution";
import { dedupeDemoJobs, type DemoJob } from "@/lib/demoJobs";
import {
  demoJobsUrl,
  trackSearchFromJobsPayload,
} from "@/lib/fetchDemoJobsClient";
import { saveJobSession } from "@/lib/jobSession";
import { captureLeadId, loadLeadId } from "@/lib/leadClient";
import { looksLikeMultipleRoles } from "@/lib/splitRoles";
import { startCheckout } from "@/lib/startCheckout";

export function FinalV3() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") || searchParams.get("q") || "";

  const [role, setRole] = useState(initialRole);
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(initialRole.trim().length > 1);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(() => loadLeadId());

  async function logLead(trimmed: string, list: DemoJob[], cached: boolean) {
    const attr = loadAttribution() || {};
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: trimmed,
          channel: "demo",
          jobs_shown: list.slice(0, 20),
          cached,
          funnel_variant: "v3",
          ...attr,
        }),
        keepalive: true,
      });
      const payload = await res.json().catch(() => ({}));
      const id = captureLeadId(payload);
      if (id) setLeadId(id);
    } catch {
      /* não bloqueia */
    }
  }

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    if (looksLikeMultipleRoles(trimmed)) {
      setRole(trimmed);
      setError(null);
      return;
    }

    setRole(trimmed);
    setLoading(true);
    setSearched(true);
    setError(null);
    setJobs([]);

    try {
      const { url: jobsUrl, eventId: searchId } = demoJobsUrl(trimmed);
      const res = await fetch(jobsUrl);
      const data = await res.json().catch(() => ({}));
      trackSearchFromJobsPayload(trimmed, data, searchId);
      const list = dedupeDemoJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setJobs(list);
      saveJobSession(trimmed, list);
      setError(
        list.length === 0
          ? data.error ||
              `Não encontramos vagas remotas para “${trimmed}” agora.`
          : null
      );
      void logLead(trimmed, list, Boolean(data.cached));
    } catch {
      setJobs([]);
      setError("Falha ao buscar vagas. Tente novamente.");
      void logLead(trimmed, [], false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    captureAttributionFromUrl(searchParams);
  }, [searchParams]);

  useEffect(() => {
    if (initialRole.trim().length > 1) {
      void runSearch(initialRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runSearch(role);
  }

  async function onCheckout() {
    const nextRole = role.trim() || "SEO";
    saveJobSession(nextRole, jobs);
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const result = await startCheckout({
        role: nextRole,
        funnelVariant: "v3",
      });
      if ("error" in result) {
        setCheckoutError(result.error);
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch {
      setCheckoutError("Falha ao abrir o pagamento. Tente de novo.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (searched) {
    return (
      <FeedConvertV3
        role={role.trim() || "seu cargo"}
        jobs={jobs}
        loading={loading}
        error={error}
        onCheckout={() => void onCheckout()}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
        leadId={leadId}
        funnelVariant="v3"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#06140f] text-[#eef6f1]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% -10%, #123b2b 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-[620px] px-4 pt-5 pb-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/">
            <BrandMark light size="sm" />
          </Link>
          <span className="rounded-full border border-[#c6ef78]/30 bg-[#c6ef78]/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#c6ef78] uppercase">
            /final/v3
          </span>
        </header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight">
          Veja a V3
        </h1>
        <p className="mt-2 text-sm text-[#9db3a8]">
          Digite o cargo e abre o pré-checkout com a lista das demais vagas
          bloqueadas.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Um cargo. Ex.: Assistente administrativo"
            className="flex-1 rounded-2xl border border-[#1d3a2e] bg-[#0d241b] px-4 py-3.5 text-[#eef6f1] outline-none placeholder:text-[#9db3a8] focus:border-[#c6ef78]/50"
            autoFocus
          />
          <button
            type="submit"
            disabled={role.trim().length < 2}
            className="rounded-2xl bg-[#c6ef78] px-5 py-3.5 text-sm font-extrabold text-[#071511] disabled:opacity-40"
          >
            Buscar
          </button>
        </form>
        <RoleChoiceHint value={role} onPick={(next) => void runSearch(next)} />
        <p className="mt-8 text-center text-xs text-[#9db3a8]">
          <Link href="/final" className="underline hover:text-[#eef6f1]">
            /final
          </Link>
          {" · "}
          <Link href="/final/v2" className="underline hover:text-[#eef6f1]">
            /final/v2
          </Link>
        </p>
      </div>
    </div>
  );
}
