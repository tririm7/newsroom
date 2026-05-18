import Link from "next/link";

import type { FooterPage } from "@/lib/db/queries";
import type { Project } from "@/lib/db/schema";

export function SiteFooter({
  project,
  locale,
  footerPages,
  madeWithLabel,
}: {
  project: Project;
  locale: string;
  footerPages: FooterPage[];
  madeWithLabel: string;
}) {
  return (
    <footer className="border-t border-[var(--divider)] mt-16">
      <div className="max-w-3xl mx-auto px-5 py-6 text-sm text-[var(--meta)] flex flex-col gap-3">
        <div className="flex gap-4 flex-wrap">
          {footerPages.map((p) => (
            <Link key={p.slug} href={`/${locale}/${p.slug}`} className="no-underline hover:underline">
              {p.title}
            </Link>
          ))}
        </div>
        <div className="flex justify-between items-baseline gap-2 flex-wrap">
          <span>© {new Date().getFullYear()} {project.brandName}</span>
          <span>
            <a href="https://github.com/tririm7/newsroom" target="_blank" rel="noopener noreferrer">
              {madeWithLabel}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
