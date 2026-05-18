import { StaticPagesTable } from "@/components/admin/StaticPagesTable";
import { listAllStaticPages } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function PagesPage() {
  const project = await getCurrentProject();
  const rows = await listAllStaticPages(project.id);
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-2">Static pages</h1>
      <p className="text-sm text-gray-500 mb-4">
        Per-locale CMS for /[locale]/[slug] routes. Pages with a footer position
        appear in the public-site footer in ascending order.
      </p>
      <StaticPagesTable initial={rows.map((p) => ({
        id: p.id, slug: p.slug, title: p.title, locale: p.locale,
        isPublished: p.isPublished, footerPosition: p.footerPosition,
      }))} />
    </section>
  );
}
