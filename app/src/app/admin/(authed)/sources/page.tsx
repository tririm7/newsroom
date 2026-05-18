import { SourcesTable } from "@/components/admin/SourcesTable";
import { listAllSources } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const project = await getCurrentProject();
  const sources = await listAllSources(project.id);
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Sources</h1>
      <SourcesTable initial={sources.map((s) => ({
        id: s.id, name: s.name, url: s.url, type: s.type,
        language: s.language, tier: s.tier, isActive: s.isActive,
      }))} />
    </section>
  );
}
