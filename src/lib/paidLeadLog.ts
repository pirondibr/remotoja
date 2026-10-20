import { cookies } from "next/headers";
import type { DemoJob } from "@/lib/demoJobs";
import {
  findLatestLeadAnswersByEmail,
  hasRecentPaidLead,
  logLeadSearch,
} from "@/lib/leadLog";
import { MEMBER_COOKIE, parseMemberToken } from "@/lib/memberAuth";
import { getOrder } from "@/lib/orders";

/** Grava no admin o que o membro pagante viu no feed pago (além do demo). */
export async function logPaidMemberView(input: {
  request: Request;
  role: string;
  jobs: DemoJob[];
  cached: boolean;
}): Promise<void> {
  try {
    const jar = await cookies();
    const member = parseMemberToken(jar.get(MEMBER_COOKIE)?.value);
    if (!member) return;

    const order = await getOrder(member.orderId);
    const email =
      (order?.payer_email || "").trim().toLowerCase() || undefined;
    if (
      email &&
      (await hasRecentPaidLead({ email, role: input.role }))
    ) {
      return;
    }

    const previous = email
      ? await findLatestLeadAnswersByEmail(email)
      : null;
    await logLeadSearch({
      role: input.role,
      channel: "paid",
      jobs_shown: input.jobs.slice(0, 40),
      cached: input.cached,
      user_agent: input.request.headers.get("user-agent"),
      answers: {
        ...(previous || {}),
        ...(email ? { email } : {}),
        role: input.role,
      },
    });
  } catch {
    // não bloqueia o feed
  }
}
