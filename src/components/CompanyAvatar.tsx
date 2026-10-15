"use client";

import { useState } from "react";

function companyInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

export function CompanyAvatar({
  company,
  logoUrl,
  tone = "light",
  size = "md",
}: {
  company: string;
  logoUrl?: string | null;
  tone?: "light" | "dark";
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const text = size === "sm" ? "text-sm" : "text-sm";
  const fallback =
    tone === "dark"
      ? "bg-cream text-ink"
      : "bg-forest text-lime";

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={44}
        height={44}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${dim} shrink-0 rounded-full object-cover bg-white ring-1 ring-black/5`}
      />
    );
  }

  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full ${fallback} ${text} font-bold`}
    >
      {companyInitial(company)}
    </div>
  );
}
