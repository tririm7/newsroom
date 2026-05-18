import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createStaticPage, listAllStaticPages } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const project = await getCurrentProject();
  return NextResponse.json(await listAllStaticPages(project.id));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const project = await getCurrentProject();
  const body = await req.json();
  for (const k of ["slug", "title", "locale", "contentHtml"] as const) {
    if (typeof body[k] !== "string" || !body[k].trim()) {
      return new NextResponse(`${k} required`, { status: 400 });
    }
  }
  const id = await createStaticPage(project.id, {
    slug: String(body.slug).slice(0, 100),
    title: String(body.title).slice(0, 200),
    locale: String(body.locale).slice(0, 8),
    contentHtml: String(body.contentHtml),
    contentMarkdown: String(body.contentMarkdown ?? body.contentHtml),
    isPublished: Boolean(body.isPublished),
    footerPosition: body.footerPosition === null || body.footerPosition === undefined
      ? null : Number(body.footerPosition),
  });
  return NextResponse.json({ id });
}
