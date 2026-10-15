import type { Metadata } from "next";
import { Suspense } from "react";
import { Manrope, Syne } from "next/font/google";
import { AttributionBoot } from "@/components/AttributionBoot";
import "./globals.css";

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Minha Vaga Remota — Vagas remotas no Brasil antes do LinkedIn",
  description:
    "Agregamos vagas remotas de vários portais no Brasil. Aplique cedo, com filtros por salário, senioridade e fontes fora do LinkedIn.",
  openGraph: {
    title: "Minha Vaga Remota — Vagas remotas no Brasil antes do LinkedIn",
    description:
      "Escaneamos portais e páginas de carreira para você candidatar antes da fila.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Suspense fallback={null}>
          <AttributionBoot />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
