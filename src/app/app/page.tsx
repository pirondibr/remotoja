import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canOpenPaidFeed, getMemberSession } from "@/lib/access";
import { JobsDashboard } from "@/components/JobsDashboard";

export const metadata: Metadata = {
  title: "Meu feed · Minha Vaga Remota",
  description: "Portal de membros com vagas remotas encontradas para o seu perfil.",
  robots: { index: false, follow: false },
};

function firstQuery(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) return (value[0] || "").trim();
  return (value || "").trim();
}

export default async function MemberAppPage(props: PageProps<"/app">) {
  const searchParams = await props.searchParams;
  const roleFromUrl = firstQuery(searchParams.role) || firstQuery(searchParams.q);
  const member = await getMemberSession();
  const defaultRole = (member?.role || "").trim();
  const role = roleFromUrl || defaultRole;

  if (!(await canOpenPaidFeed(role))) {
    redirect("/onboard");
  }

  return <JobsDashboard defaultRole={role} />;
}
