import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { listAllArticles } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function ArticlesAdminPage() {
  const project = await getCurrentProject();
  const articles = await listAllArticles(project.id);
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Articles</h1>
      <ArticlesTable initial={articles.map((a) => ({
        id: a.id, slug: a.slug, title: a.title, status: a.status,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        isManual: a.isManual, language: a.language,
      }))} />
    </section>
  );
}
