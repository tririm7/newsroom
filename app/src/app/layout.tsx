import type { ReactNode } from "react";

export const metadata = {
  title: "Newsroom",
  description: "Self-hosted AI news aggregator",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
