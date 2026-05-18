import { notFound } from "next/navigation";

import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { getArticleByIdForAdmin } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const project = await getCurrentProject();
  const article = await getArticleByIdForAdmin(project.id, id);
  if (!article) notFound();

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Edit article</h1>
      <ArticleEditor initial={{
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        contentHtml: article.contentHtml,
        imageUrl: article.imageUrl,
        status: article.status,
        language: article.language,
      }} />
    </section>
  );
}
