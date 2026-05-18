import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createSource, listAllSources } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const project = await getCurrentProject();
  const rows = await listAllSources(project.id);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const project = await getCurrentProject();
  const body = await req.json();
  const required = ["name", "url"] as const;
  for (const k of required) {
    if (!body[k] || typeof body[k] !== "string") {
      return new NextResponse(`Missing or invalid: ${k}`, { status: 400 });
    }
  }
  const id = await createSource(project.id, {
    name: String(body.name).slice(0, 200),
    url: String(body.url).slice(0, 500),
    type: String(body.type ?? "rss"),
    language: String(body.language ?? "en"),
    tier: Number.isFinite(body.tier) ? Math.max(1, Math.min(5, body.tier)) : 3,
    isActive: body.isActive !== false,
  });
  return NextResponse.json({ id });
}
