"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function CreateAccountForm() {
  const router = useRouter();
  const params = useSearchParams();
  const roleFromUrl = params.get("role") || "";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(roleFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conta/prefill");
        const data = (await res.json()) as {
          email?: string;
          role?: string;
          hasAccount?: boolean;
        };
        if (cancelled) return;
        if (data.hasAccount) {
          router.replace(
            `/app?role=${encodeURIComponent(data.role || roleFromUrl)}`
          );
          return;
        }
        if (data.email && !username) setUsername(data.email);
        if (data.role) setRole(data.role);
      } catch {
        /* segue o formulário */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, roleFromUrl]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/conta/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          email: username,
        }),
      });
      const data = (await res.json()) as { error?: string; role?: string };
      if (!res.ok) {
        setError(data.error || "Não foi possível criar o login.");
        return;
      }
      const nextRole = data.role || role || roleFromUrl;
      router.replace(`/app?role=${encodeURIComponent(nextRole)}`);
    } catch {
      setError("Falha de rede. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  const feedHref = `/app?role=${encodeURIComponent(role || roleFromUrl || "")}`;

  return (
    <div className="bg-mesh relative flex min-h-screen flex-col items-center justify-center px-6 text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <BrandMark light size="sm" />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold">
          Crie seu acesso
        </h1>
        <p className="mt-2 text-sm text-sand/70">
          Leva 10 segundos. Depois você entra de qualquer celular ou computador
          para ver suas vagas.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-sand/70">Usuário (seu e-mail)</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              autoComplete="username"
              required
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-cream outline-none placeholder:text-sand/40 focus:border-lime/50"
              placeholder="voce@email.com"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-sand/70">Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-cream outline-none placeholder:text-sand/40 focus:border-lime/50"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-lime py-3.5 text-sm font-bold text-ink hover:bg-mint disabled:opacity-50"
          >
            {loading ? "Criando…" : "Criar login e ver vagas"}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-xs text-sand/50">
          <Link href="/entrar" className="hover:text-sand/80">
            Já tenho login
          </Link>
          {(role || roleFromUrl) && (
            <Link href={feedHref} className="hover:text-sand/80">
              Ver vagas agora
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
