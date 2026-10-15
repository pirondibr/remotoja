import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lab · RemotoJá",
  robots: { index: false, follow: false },
};

/** Atalho secreto: /lab?k=DEMO_ACCESS_SECRET&role=seo */
export default function LabPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 text-ink">
      <p className="max-w-sm text-center text-sm text-moss/70">
        Use <code className="text-moss">/lab?k=SEU_SEGREDO&amp;role=seo</code>{" "}
        para liberar o feed de teste.
      </p>
    </div>
  );
}
