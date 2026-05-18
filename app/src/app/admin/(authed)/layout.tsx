import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth, signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/login" });
}

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/keywords", label: "Keywords" },
  { href: "/admin/clusters", label: "Clusters" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AuthedAdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-gray-200">
          <Link href="/admin" className="font-semibold text-base">Newsroom admin</Link>
        </div>
        <nav className="flex flex-col text-sm px-2 py-3 gap-1 flex-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-2 py-1.5 rounded hover:bg-gray-200"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="p-3 border-t border-gray-200">
          <button type="submit" className="text-xs text-gray-600 hover:underline">
            Sign out ({session.user?.name})
          </button>
        </form>
      </aside>
      <main className="flex-1 px-8 py-6 max-w-5xl">{children}</main>
    </div>
  );
}
