import { handleDemoAction } from "@/lib/demo-data";
import { callErpNextMobileApp } from "@/lib/server/erpnext";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function toCamelCaseKey(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeKeys(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        toCamelCaseKey(key),
        normalizeKeys(nestedValue)
      ])
    ) as T;
  }

  return value;
}

async function getRequestParams(request: NextRequest) {
  if (request.method === "GET") {
    return Object.fromEntries(request.nextUrl.searchParams.entries());
  }

  try {
    return (await request.json()) as Record<string, string>;
  } catch {
    return {};
  }
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return "ERPNext request could not be completed.";
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

  if (!process.env.ERPNEXT_BASE_URL) {
    return NextResponse.json(normalizeKeys(handleDemoAction(action, params)));
  }

  try {
    const payload = await callErpNextMobileApp(action, params, sid);
    return NextResponse.json(normalizeKeys(payload), {
      status: payload.success ? 200 : 400
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        action,
        data: null,
        error: formatErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
