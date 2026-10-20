import { cookies } from "next/headers";
import type { DemoJob } from "@/lib/demoJobs";
import {
  findLatestLeadAnswersByEmail,
  findRecentPaidLead,
  logLeadSearch,
  updateLeadSearchJobs,
} from "@/lib/leadLog";
import { MEMBER_COOKIE, parseMemberToken } from "@/lib/memberAuth";
import { getOrder } from "@/lib/orders";

async function answersForPaid(input: {
  role: string;
  email?: string | null;
}) {
  const email = (input.email || "").trim().toLowerCase() || undefined;
  const previous = email ? await findLatestLeadAnswersByEmail(email) : null;
  return {
    ...(previous || {}),
    ...(email ? { email } : {}),
    role: input.role,
  };
}

/** Cria a linha Pago no admin assim que o Mercado Pago confirma — sem esperar o membro abrir o feed. */
export async function logPaidPurchase(input: {
  role: string;
  email?: string | null;
  funnelVariant?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const role = input.role.trim();
    if (role.length < 2) return;
    const email = (input.email || "").trim().toLowerCase();
    if (email && (await findRecentPaidLead({ email, role }))) return;
    await logLeadSearch({
      role,
      channel: "paid",
      jobs_shown: [],
      cached: false,
      user_agent: input.userAgent,
      funnel_variant: input.funnelVariant,
      answers: await answersForPaid({ role, email }),
    });
  } catch {
    // não bloqueia checkout
  }
}

/** Atualiza o Pago com as vagas que o membro de fato viu. */
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
    const role = input.role.trim();
    const existing = email
      ? await findRecentPaidLead({ email, role })
      : null;
    if (existing) {
      if (input.jobs.length > 0 || existing.jobs_count === 0) {
        await updateLeadSearchJobs({
          id: existing.id,
          jobs: input.jobs,
          cached: input.cached,
        });
      }
      return;
    }

    await logLeadSearch({
      role,
      channel: "paid",
      jobs_shown: input.jobs.slice(0, 40),
      cached: input.cached,
      user_agent: input.request.headers.get("user-agent"),
      funnel_variant: order?.funnel_variant,
      answers: await answersForPaid({ role, email }),
    });
  } catch {
    // não bloqueia o feed
  }
}
