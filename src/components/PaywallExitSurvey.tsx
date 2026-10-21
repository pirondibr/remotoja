"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PAYWALL_REASONS,
  type PaywallReasonId,
} from "@/lib/paywallReasons";

const DONE_KEY = "mvr_paywall_fb_done";
const DONE_EVENT = "mvr-paywall-fb-done";

type FeedbackStatus = "open" | "answered" | "skipped";

function readStatus(): FeedbackStatus {
  try {
    const value = sessionStorage.getItem(DONE_KEY);
    if (value === "answered" || value === "1") return "answered";
    if (value === "skipped") return "skipped";
  } catch {
    /* ignore */
  }
  return "open";
}

function persistStatus(status: Exclude<FeedbackStatus, "open">) {
  try {
    sessionStorage.setItem(DONE_KEY, status);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(DONE_EVENT));
}

function isHomeHref(href: string | null): boolean {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin && url.pathname === "/";
  } catch {
    return href === "/";
  }
}

type SurveyOpts = {
  enabled: boolean;
  blocked?: boolean;
  role: string;
  email?: string;
  leadId?: string | null;
  funnelVariant?: string | null;
};

function useFeedbackStatus() {
  const [status, setStatus] = useState<FeedbackStatus>("open");

  useEffect(() => {
    setStatus(readStatus());
    const sync = () => setStatus(readStatus());
    window.addEventListener(DONE_EVENT, sync);
    return () => window.removeEventListener(DONE_EVENT, sync);
  }, []);

  return [status, setStatus] as const;
}

function usePaywallFeedback(opts: SurveyOpts) {
  const { role, email, leadId, funnelVariant } = opts;
  const [status, setStatus] = useFeedbackStatus();
  const [reason, setReason] = useState<PaywallReasonId | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);

  const finish = useCallback((next: Exclude<FeedbackStatus, "open">) => {
    persistStatus(next);
    setStatus(next);
  }, [setStatus]);

  async function submit(nextReason: PaywallReasonId, nextDetail?: string) {
    if (sending || status !== "open") return;
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: nextReason,
          detail: (nextDetail || "").trim() || undefined,
          role,
          email: email || undefined,
          lead_id: leadId || undefined,
          funnel_variant: funnelVariant || undefined,
        }),
        keepalive: true,
      });
    } catch {
      /* still close — não prender o usuário */
    } finally {
      setSending(false);
      finish("answered");
    }
  }

  function pick(id: PaywallReasonId) {
    setReason(id);
    if (id === "other") return;
    void submit(id);
  }

  return {
    status,
    reason,
    detail,
    setDetail,
    sending,
    pick,
    submit,
    skip: () => finish("skipped"),
  };
}

function FeedbackChoices({
  eyebrow,
  title,
  titleId,
  reason,
  detail,
  setDetail,
  sending,
  onPick,
  onSubmitOther,
  onSkip,
}: {
  eyebrow: string;
  title: string;
  titleId?: string;
  reason: PaywallReasonId | null;
  detail: string;
  setDetail: (value: string) => void;
  sending: boolean;
  onPick: (id: PaywallReasonId) => void;
  onSubmitOther: () => void;
  onSkip?: () => void;
}) {
  return (
    <>
      <p className="text-xs font-semibold tracking-wide text-lime uppercase">
        {eyebrow}
      </p>
      <h2
        id={titleId}
        className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight"
      >
        {title}
      </h2>
      <div className="mt-4 grid gap-2">
        {PAYWALL_REASONS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={sending}
            onClick={() => onPick(item.id)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition disabled:opacity-50 ${
              reason === item.id
                ? "border-lime bg-lime/10 text-cream"
                : "border-white/12 bg-white/5 text-cream/90 hover:border-white/30"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {reason === "other" && (
        <div className="mt-3">
          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Conta pra gente em uma frase"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-cream outline-none placeholder:text-sand/40 focus:border-lime/50"
          />
          <button
            type="button"
            disabled={sending}
            onClick={onSubmitOther}
            className="mt-2 w-full rounded-full bg-lime py-3 text-sm font-bold text-ink disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
      {onSkip && (
        <button
          type="button"
          disabled={sending}
          onClick={onSkip}
          className="mt-4 w-full text-center text-xs text-sand/50 hover:text-sand/80"
        >
          Pular
        </button>
      )}
    </>
  );
}

export function PaywallFeedbackBlock(opts: SurveyOpts) {
  const feedback = usePaywallFeedback(opts);
  if (!opts.enabled || opts.blocked) return null;
  if (feedback.status === "skipped") return null;
  if (feedback.status === "answered") {
    return (
      <section className="mt-6 rounded-2xl border border-lime/25 bg-lime/8 px-4 py-4 text-sm text-cream/90">
        Obrigado. Isso nos ajuda a melhorar o feed.
      </section>
    );
  }
  return (
    <section className="mt-6 rounded-2xl border border-white/12 bg-white/5 p-5">
      <FeedbackChoices
        eyebrow="Uma pergunta rápida"
        title="O que te impede de desbloquear as vagas?"
        reason={feedback.reason}
        detail={feedback.detail}
        setDetail={feedback.setDetail}
        sending={feedback.sending}
        onPick={feedback.pick}
        onSubmitOther={() => void feedback.submit("other", feedback.detail)}
      />
    </section>
  );
}

export function usePaywallExitSurvey(opts: SurveyOpts) {
  const { enabled, blocked } = opts;
  const feedback = usePaywallFeedback(opts);
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const statusRef = useRef(feedback.status);
  const openRef = useRef(false);
  const blockedRef = useRef(Boolean(blocked));
  const enabledRef = useRef(enabled);

  useEffect(() => {
    statusRef.current = feedback.status;
    if (feedback.status !== "open") setOpen(false);
  }, [feedback.status]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    blockedRef.current = Boolean(blocked);
  }, [blocked]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const finishAndLeave = useCallback((next: Exclude<FeedbackStatus, "open">) => {
    if (next === "skipped") feedback.skip();
    setOpen(false);
    const leave = pendingRef.current;
    pendingRef.current = null;
    leave?.();
    // skip already persisted; answered is persisted by submit
    if (next === "skipped") return;
  }, [feedback]);

  const ask = useCallback((onLeave?: () => void) => {
    if (!enabledRef.current || blockedRef.current || statusRef.current !== "open") {
      onLeave?.();
      return false;
    }
    if (openRef.current) {
      if (onLeave) pendingRef.current = onLeave;
      return true;
    }
    pendingRef.current = onLeave || null;
    setOpen(true);
    return true;
  }, []);

  const confirmLeave = useCallback(
    (onLeave: () => void) => {
      if (!enabled || blocked || feedback.status !== "open") {
        onLeave();
        return;
      }
      ask(onLeave);
    },
    [ask, blocked, enabled, feedback.status]
  );

  useEffect(() => {
    if (!enabled || blocked || feedback.status !== "open") return;

    history.pushState({ mvrPaywall: 1 }, "", location.href);
    const openedAt = Date.now();
    const minDwellMs = 30_000;

    const onPop = () => {
      if (statusRef.current !== "open" || blockedRef.current || !enabledRef.current) {
        return;
      }
      history.pushState({ mvrPaywall: 1 }, "", location.href);
      ask(() => {
        history.back();
      });
    };

    const onMouseLeave = (event: MouseEvent) => {
      if (event.clientY > 0) return;
      if (Date.now() - openedAt < minDwellMs) return;
      if (statusRef.current !== "open" || blockedRef.current || openRef.current) {
        return;
      }
      ask();
    };

    const onClick = (event: MouseEvent) => {
      if (statusRef.current !== "open" || blockedRef.current || !enabledRef.current) {
        return;
      }
      const el = (event.target as Element | null)?.closest("a");
      if (!el) return;
      if (!isHomeHref(el.getAttribute("href"))) return;
      event.preventDefault();
      event.stopPropagation();
      ask(() => {
        window.location.href = "/";
      });
    };

    window.addEventListener("popstate", onPop);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("click", onClick, true);
    };
  }, [ask, blocked, enabled, feedback.status]);

  const modal =
    open && feedback.status === "open" ? (
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-exit-title"
        onClick={() => finishAndLeave("skipped")}
      >
        <div
          className="w-full max-w-md rounded-3xl border border-white/12 bg-[#0b1f18] p-5 text-cream shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <FeedbackChoices
            eyebrow="Antes de ir, uma pergunta rápida"
            title="O que te impediu de desbloquear as vagas?"
            titleId="paywall-exit-title"
            reason={feedback.reason}
            detail={feedback.detail}
            setDetail={feedback.setDetail}
            sending={feedback.sending}
            onPick={(id) => {
              feedback.pick(id);
              if (id !== "other") {
                const leave = pendingRef.current;
                pendingRef.current = null;
                setOpen(false);
                leave?.();
              }
            }}
            onSubmitOther={() => {
              const leave = pendingRef.current;
              pendingRef.current = null;
              void feedback.submit("other", feedback.detail).then(() => {
                setOpen(false);
                leave?.();
              });
            }}
            onSkip={() => finishAndLeave("skipped")}
          />
        </div>
      </div>
    ) : null;

  return { modal, confirmLeave };
}

export function PaywallExitSurvey(props: SurveyOpts) {
  const { modal } = usePaywallExitSurvey(props);
  return modal;
}
