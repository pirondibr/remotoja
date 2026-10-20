"use client";

import { looksLikeMultipleRoles, splitRoleQuery } from "@/lib/splitRoles";

export function RoleChoiceHint({
  value,
  onPick,
  tone = "dark",
}: {
  value: string;
  onPick: (role: string) => void;
  tone?: "dark" | "light";
}) {
  if (!looksLikeMultipleRoles(value)) return null;
  const roles = splitRoleQuery(value);
  const dark = tone === "dark";

  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 ${
        dark
          ? "border-lime/30 bg-lime/10 text-cream"
          : "border-moss/20 bg-mint/20 text-ink"
      }`}
    >
      <p className={`text-sm font-semibold ${dark ? "text-lime" : "text-forest"}`}>
        Um cargo por vez
      </p>
      <p className={`mt-1 text-xs leading-relaxed ${dark ? "text-sand/80" : "text-moss/80"}`}>
        Se misturar vários cargos, a busca não acha vaga nenhuma. Escolha um
        agora — depois você pesquisa os outros.
      </p>
      {roles.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onPick(role)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                dark
                  ? "bg-lime text-ink hover:bg-mint"
                  : "bg-ink text-cream hover:bg-forest"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
