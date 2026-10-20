"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/conta/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string; role?: string };
      if (!res.ok) {
        setError(data.error || "Não foi possível entrar.");
        return;
      }
      router.replace(
        `/app?role=${encodeURIComponent(data.role || "")}`
      );
    } catch {
      setError("Falha de rede. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-mesh relative flex min-h-screen flex-col items-center justify-center px-6 text-cream">
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <BrandMark light size="sm" />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold">
          Entrar no feed
        </h1>
        <p className="mt-2 text-sm text-sand/70">
          Use o usuário e a senha que você criou depois do pagamento.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-sand/70">Usuário</span>
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
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-cream outline-none placeholder:text-sand/40 focus:border-lime/50"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-lime py-3.5 text-sm font-bold text-ink hover:bg-mint disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-sand/50">
          Pagou e ainda não criou o login?{" "}
          <Link href="/conta/criar" className="text-lime hover:underline">
            Criar agora
          </Link>
        </p>
      </div>
    </div>
  );
}
