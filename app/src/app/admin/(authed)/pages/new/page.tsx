import { StaticPageEditor } from "@/components/admin/StaticPageEditor";
import { getCurrentProject, SUPPORTED_LOCALES } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function NewPagePage() {
  const project = await getCurrentProject();
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">New page</h1>
      <StaticPageEditor
        locales={[...SUPPORTED_LOCALES]}
        initial={{
          slug: "",
          title: "",
          locale: project.primaryLocale,
          contentHtml: "<p>Edit me.</p>",
          isPublished: false,
          footerPosition: null,
        }}
      />
    </section>
  );
}
