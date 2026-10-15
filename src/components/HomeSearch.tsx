"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const POPULAR_ROLES = [
  "Analista de SEO",
  "Designer",
  "Desenvolvedor",
  "Customer Success",
  "Marketing",
  "Dados",
];

export function HomeSearch({
  id,
  autoFocus = false,
}: {
  id?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [pending, setPending] = useState(false);

  function go(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    setPending(true);
    router.push(`/final/v2?role=${encodeURIComponent(trimmed)}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    go(role);
  }

  return (
    <div id={id} className="w-full scroll-mt-24">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur-md sm:flex-row"
      >
        <label htmlFor={`${id ?? "busca"}-input`} className="sr-only">
          Qual cargo você busca?
        </label>
        <input
          id={`${id ?? "busca"}-input`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Qual cargo você busca? Ex.: Analista de SEO"
          autoFocus={autoFocus}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3.5 text-base text-ink outline-none placeholder:text-moss/50 focus:ring-2 focus:ring-lime"
        />
        <button
          type="submit"
          disabled={pending || role.trim().length < 2}
          className="rounded-xl bg-lime px-6 py-3.5 text-base font-bold text-ink transition hover:bg-mint disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Buscando…" : "Ver vagas grátis"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-sand/60">Mais buscados:</span>
        {POPULAR_ROLES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => go(item)}
            disabled={pending}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-sand/85 transition hover:border-lime hover:text-lime"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
