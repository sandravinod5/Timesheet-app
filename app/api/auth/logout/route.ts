import { clearSessionCookies, logoutFromErpNext } from "@/lib/server/erpnext";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("erpnext_sid")?.value;

  await logoutFromErpNext(sid);

  const response = NextResponse.json({ success: true });
  clearSessionCookies(response);
  return response;
}
