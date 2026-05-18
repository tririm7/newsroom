import { compare } from "bcryptjs";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getUserByIdForProject, hashPassword, updateUserPasswordHash } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const oldPassword = String(body.oldPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 12) {
    return new NextResponse("Password must be at least 12 characters.", { status: 400 });
  }

  const project = await getCurrentProject();
  const userId = Number(session.user.id);
  const user = await getUserByIdForProject(project.id, userId);
  if (!user) return new NextResponse("User not found.", { status: 404 });

  const ok = await compare(oldPassword, user.passwordHash);
  if (!ok) return new NextResponse("Current password is wrong.", { status: 400 });

  const newHash = await hashPassword(newPassword);
  await updateUserPasswordHash(user.id, newHash);
  return NextResponse.json({ ok: true });
}
