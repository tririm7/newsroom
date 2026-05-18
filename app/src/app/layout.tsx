import type { ReactNode } from "react";

import "./globals.css";

// Root layout owns <html>/<body>. Brand color + lang attribute are set
// inside the [locale] subtree (where we can hit the DB cleanly).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
