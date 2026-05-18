import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { deleteStaticPage, getStaticPageByIdForAdmin, updateStaticPage } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });
  const project = await getCurrentProject();
  const page = await getStaticPageByIdForAdmin(project.id, id);
  if (!page) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(page);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });
  const project = await getCurrentProject();
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.slug === "string") patch.slug = body.slug.slice(0, 100);
  if (typeof body.title === "string") patch.title = body.title.slice(0, 200);
  if (typeof body.locale === "string") patch.locale = body.locale.slice(0, 8);
  if (typeof body.contentHtml === "string") patch.contentHtml = body.contentHtml;
  if (typeof body.contentMarkdown === "string") patch.contentMarkdown = body.contentMarkdown;
  if (typeof body.isPublished === "boolean") patch.isPublished = body.isPublished;
  if (body.footerPosition === null) patch.footerPosition = null;
  else if (typeof body.footerPosition === "number") patch.footerPosition = body.footerPosition;
  await updateStaticPage(project.id, id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });
  const project = await getCurrentProject();
  await deleteStaticPage(project.id, id);
  return NextResponse.json({ ok: true });
}
