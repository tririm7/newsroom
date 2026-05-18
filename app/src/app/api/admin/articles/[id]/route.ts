import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { deleteArticle, toggleArticleStatus, updateArticle } from "@/lib/admin/queries";
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
  if (body.action === "edit") {
    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") patch.title = body.title.slice(0, 300);
    if (typeof body.slug === "string") patch.slug = body.slug.slice(0, 100);
    if (typeof body.excerpt === "string" || body.excerpt === null) patch.excerpt = body.excerpt;
    if (typeof body.contentHtml === "string") patch.contentHtml = body.contentHtml;
    if (typeof body.imageUrl === "string" || body.imageUrl === null) patch.imageUrl = body.imageUrl;
    if (body.status === "published" || body.status === "draft") patch.status = body.status;
    await updateArticle(project.id, id, patch);
    return NextResponse.json({ ok: true });
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
