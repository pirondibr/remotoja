import { NextResponse } from "next/server";
import { getMemberSession } from "@/lib/access";
import { findAccountByOrderId } from "@/lib/memberAccounts";
import { getOrder } from "@/lib/orders";

export async function GET() {
  const member = await getMemberSession();
  if (!member) {
    return NextResponse.json({
      email: "",
      role: "",
      hasAccount: false,
    });
  }
  const [order, account] = await Promise.all([
    getOrder(member.orderId),
    findAccountByOrderId(member.orderId),
  ]);
  return NextResponse.json({
    email: (order?.payer_email || "").trim(),
    role: member.role || order?.role || "",
    hasAccount: Boolean(account),
  });
}
