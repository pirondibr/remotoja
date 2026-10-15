import { redirect } from "next/navigation";
import { hasMemberAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function MemberAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await hasMemberAccess();
  if (!ok) {
    redirect("/onboard");
  }
  return children;
}
