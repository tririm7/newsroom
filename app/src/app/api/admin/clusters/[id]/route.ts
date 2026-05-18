import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { deactivateCluster, reactivateCluster } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new NextResponse("Bad id", { status: 400 });
  const project = await getCurrentProject();
  const body = await req.json();
  if (typeof body.isActive !== "boolean") {
    return new NextResponse("isActive (boolean) required", { status: 400 });
  }
  if (body.isActive) {
    await reactivateCluster(project.id, id);
  } else {
    await deactivateCluster(project.id, id);
  }
  return NextResponse.json({ ok: true });
}
