import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { deleteKeyword, updateKeyword } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });
  const project = await getCurrentProject();
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.pattern === "string") patch.pattern = body.pattern.slice(0, 300);
  if (typeof body.category === "string") patch.category = body.category.slice(0, 60);
  if (typeof body.isRegex === "boolean") patch.isRegex = body.isRegex;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  await updateKeyword(project.id, id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });
  const project = await getCurrentProject();
  await deleteKeyword(project.id, id);
  return NextResponse.json({ ok: true });
}
