import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { updateProjectLLM } from "@/lib/admin/queries";
import { SUPPORTED_PROVIDERS } from "@/lib/admin/llm_test";
import { getCurrentProject } from "@/lib/project";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const project = await getCurrentProject();
  const body = await req.json();

  const provider = String(body.provider ?? "");
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    return new NextResponse(`Unknown provider: ${provider}`, { status: 400 });
  }
  const model = String(body.model ?? "").trim();
  if (!model) {
    return new NextResponse("model is required", { status: 400 });
  }

  // apiKey: empty string from the UI means "keep the existing key" (so the
  // admin can edit other fields without re-pasting). null clears it.
  // We always pass the raw value through — UI controls intent.
  const apiKey = body.apiKey === undefined || body.apiKey === ""
    ? null  // sentinel: caller didn't change it
    : String(body.apiKey);

  const baseUrl = body.baseUrl ? String(body.baseUrl).trim() : null;
  if (provider === "custom" && !baseUrl) {
    return new NextResponse("baseUrl is required when provider=custom", { status: 400 });
  }

  // If apiKey is null (sentinel "unchanged"), don't touch llm_api_key.
  // Otherwise write it (including the empty-string case if frontend sends "").
  const patch: {
    llmProvider: string; llmModel: string;
    llmApiKey: string | null; llmBaseUrl: string | null;
  } = {
    llmProvider: provider,
    llmModel: model.slice(0, 200),
    llmApiKey: apiKey === null ? (await currentKey(project.id)) : apiKey.slice(0, 500),
    llmBaseUrl: baseUrl ? baseUrl.slice(0, 500) : null,
  };

  await updateProjectLLM(project.id, patch);

  return NextResponse.json({
    ok: true,
    note: "Saved. The bot picks up the new provider on its next cron tick — no container restart needed.",
  });
}

// Helper: read the current api key when the UI didn't send a new one
// (so we preserve it across edits to other fields).
async function currentKey(projectId: number): Promise<string | null> {
  const { db } = await import("@/lib/db/client");
  const { projects } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select({ llmApiKey: projects.llmApiKey })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  return rows[0]?.llmApiKey ?? null;
}
