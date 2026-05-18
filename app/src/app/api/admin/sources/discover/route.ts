import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { discoverFeeds } from "@/lib/admin/discover";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const domain = String(body.domain ?? "").trim();
  if (!domain) return new NextResponse("domain required", { status: 400 });

  const feeds = await discoverFeeds(domain);
  return NextResponse.json(feeds);
}
