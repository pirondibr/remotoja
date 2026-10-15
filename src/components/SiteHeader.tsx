import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  return (
    <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-10">
      <Link href="/" aria-label="Minha Vaga Remota início">
        <BrandMark light={dark} size="md" />
      </Link>
      <nav className="flex items-center gap-3 md:gap-5">
        <Link
          href="/precos"
          className={`text-sm font-medium transition ${
            dark ? "text-sand/80 hover:text-cream" : "text-moss hover:text-ink"
          }`}
        >
          Preços
        </Link>
        <Link
          href="/onboard"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            dark
              ? "bg-lime text-ink hover:bg-mint"
              : "bg-ink text-cream hover:bg-forest"
          }`}
        >
          Começar
        </Link>
      </nav>
    </header>
  );
}
