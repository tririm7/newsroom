import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createKeyword, listAllKeywords } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const project = await getCurrentProject();
  return NextResponse.json(await listAllKeywords(project.id));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const project = await getCurrentProject();
  const body = await req.json();
  if (typeof body.pattern !== "string" || !body.pattern.trim()) {
    return new NextResponse("pattern required", { status: 400 });
  }
  const id = await createKeyword(project.id, {
    pattern: String(body.pattern).slice(0, 300),
    category: String(body.category ?? "general").slice(0, 60),
    isRegex: Boolean(body.isRegex),
    isActive: body.isActive !== false,
  });
  return NextResponse.json({ id });
}
