import { NextResponse } from "next/server";
import { clearAdminCookieOptions } from "@/lib/adminAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const cookie = clearAdminCookieOptions();
  res.cookies.set(cookie.name, cookie.value, cookie);
  return res;
}
