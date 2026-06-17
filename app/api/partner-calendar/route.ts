import { callErpNextPartnerCalendarApp } from "@/lib/server/erpnext";
import { isPartnerCalendarUser, readSessionUser } from "@/lib/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function getRequestParams(request: NextRequest) {
  if (request.method === "GET") {
    return Object.fromEntries(request.nextUrl.searchParams.entries());
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(body).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : []))
  );
}

async function handleRequest(request: NextRequest) {
  const params = await getRequestParams(request);
  const action = params.action;

  if (!action) {
    return NextResponse.json(
      {
        success: false,
        action: null,
        data: null,
        error: "action is required"
      },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get("erpnext_sid")?.value;
  const currentUser = readSessionUser(cookieStore);

  if (!isPartnerCalendarUser(currentUser)) {
    return NextResponse.json(
      {
        success: false,
        action,
        data: null,
        error: "This account is not enabled for the Partner Calendar workflow."
      },
      { status: 403 }
    );
  }

  try {
    const payload = await callErpNextPartnerCalendarApp(action, params, sid);
    return NextResponse.json(payload, {
      status: payload.success ? 200 : 400
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        action,
        data: null,
        error: error instanceof Error ? error.message : "Partner calendar request failed."
      },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
