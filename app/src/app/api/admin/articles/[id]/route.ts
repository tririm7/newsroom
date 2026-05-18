import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { deleteArticle, toggleArticleStatus } from "@/lib/admin/queries";
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
  if (body.action === "toggle_status") {
    const next = await toggleArticleStatus(project.id, id);
    if (next === null) return new NextResponse("Not found", { status: 404 });
    return NextResponse.json({ status: next });
  }
  return new NextResponse("Unknown action", { status: 400 });
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
  await deleteArticle(project.id, id);
  return NextResponse.json({ ok: true });
}
