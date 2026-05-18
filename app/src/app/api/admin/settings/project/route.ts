import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { updateProject } from "@/lib/admin/queries";
import { getCurrentProject, SUPPORTED_LOCALES } from "@/lib/project";

const ALLOWED_LOCALES = new Set<string>(SUPPORTED_LOCALES);

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const project = await getCurrentProject();
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") patch.name = body.name.slice(0, 200);
  if (typeof body.description === "string" || body.description === null) patch.description = body.description;
  if (typeof body.brandName === "string") patch.brandName = body.brandName.slice(0, 100);
  if (typeof body.brandSuffix === "string") patch.brandSuffix = body.brandSuffix.slice(0, 8);
  if (typeof body.brandColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.brandColor)) {
    patch.brandColor = body.brandColor;
  }
  if (typeof body.brandColorHover === "string" || body.brandColorHover === null) {
    patch.brandColorHover = body.brandColorHover;
  }
  if (typeof body.primaryLocale === "string" && ALLOWED_LOCALES.has(body.primaryLocale)) {
    patch.primaryLocale = body.primaryLocale;
  }
  if (typeof body.timezone === "string") patch.timezone = body.timezone.slice(0, 60);
  if (typeof body.articleMinSources === "number") {
    patch.articleMinSources = Math.max(1, Math.min(10, body.articleMinSources));
  }
  if (typeof body.maxNewsAgeHours === "number" && body.maxNewsAgeHours > 0) {
    patch.maxNewsAgeHours = body.maxNewsAgeHours;
  }
  if (typeof body.clusterInactivityHours === "number" && body.clusterInactivityHours > 0) {
    patch.clusterInactivityHours = body.clusterInactivityHours;
  }
  if (typeof body.ingestionCron === "string") patch.ingestionCron = body.ingestionCron.slice(0, 100);
  if (typeof body.generationCron === "string") patch.generationCron = body.generationCron.slice(0, 100);
  if (typeof body.autoPublish === "boolean") patch.autoPublish = body.autoPublish;

  await updateProject(project.id, patch);
  return NextResponse.json({ ok: true });
}
