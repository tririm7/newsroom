import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { deleteSource, updateSource } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function PATCH(req: Request, { params }: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });

  const project = await getCurrentProject();
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.slice(0, 200);
  if (typeof body.url === "string") patch.url = body.url.slice(0, 500);
  if (typeof body.language === "string") patch.language = body.language;
  if (typeof body.type === "string") patch.type = body.type;
  if (typeof body.tier === "number") patch.tier = Math.max(1, Math.min(5, body.tier));
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

  await updateSource(project.id, id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });

  const project = await getCurrentProject();
  await deleteSource(project.id, id);
  return NextResponse.json({ ok: true });
}
