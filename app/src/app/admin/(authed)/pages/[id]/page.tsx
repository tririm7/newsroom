import { notFound } from "next/navigation";

import { StaticPageEditor } from "@/components/admin/StaticPageEditor";
import { getStaticPageByIdForAdmin } from "@/lib/admin/queries";
import { getCurrentProject, SUPPORTED_LOCALES } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function EditPagePage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const project = await getCurrentProject();
  const page = await getStaticPageByIdForAdmin(project.id, id);
  if (!page) notFound();

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Edit page</h1>
      <StaticPageEditor
        locales={[...SUPPORTED_LOCALES]}
        initial={{
          id: page.id,
          slug: page.slug,
          title: page.title,
          locale: page.locale,
          contentHtml: page.contentHtml,
          isPublished: page.isPublished,
          footerPosition: page.footerPosition,
        }}
      />
    </section>
  );
}
