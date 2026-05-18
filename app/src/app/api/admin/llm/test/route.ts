import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { SUPPORTED_PROVIDERS, testLLMConnection, type LLMProvider } from "@/lib/admin/llm_test";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const provider = String(body.provider ?? "");
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    return new NextResponse(`Unknown provider: ${provider}`, { status: 400 });
  }

  const result = await testLLMConnection({
    provider: provider as LLMProvider,
    model: String(body.model ?? ""),
    apiKey: String(body.apiKey ?? ""),
    baseUrl: body.baseUrl ? String(body.baseUrl) : null,
  });

  return NextResponse.json(result);
}
