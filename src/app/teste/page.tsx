import type { Metadata } from "next";
import { TesteCheckout } from "@/components/TesteCheckout";

export const metadata: Metadata = {
  title: "Teste Pix · Minha Vaga Remota",
  robots: { index: false, follow: false },
};

export default function TestePage() {
  return <TesteCheckout />;
}
