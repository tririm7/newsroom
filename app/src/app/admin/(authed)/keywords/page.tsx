import { KeywordsTable } from "@/components/admin/KeywordsTable";
import { listAllKeywords } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  const project = await getCurrentProject();
  const rows = await listAllKeywords(project.id);
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Keywords</h1>
      <p className="text-sm text-gray-500 mb-4">
        Bot drops RSS items whose title + summary don't match any active keyword. Grouped by category.
      </p>
      <KeywordsTable initial={rows.map((k) => ({
        id: k.id, pattern: k.pattern, category: k.category,
        isRegex: k.isRegex, isActive: k.isActive,
      }))} />
    </section>
  );
}
