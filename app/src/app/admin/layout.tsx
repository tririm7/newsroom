import type { ReactNode } from "react";

import "../globals.css";

// Admin section has its own minimal layout (no SiteHeader, no SiteFooter,
// no i18n provider). Authentication enforcement lives in the (authed) group.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[var(--text)] font-sans">
      {children}
    </div>
  );
}
