import { ClustersTable } from "@/components/admin/ClustersTable";
import { listClustersForAdmin } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function ClustersPage() {
  const project = await getCurrentProject();
  const rows = await listClustersForAdmin(project.id, 200);
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-2">Clusters</h1>
      <p className="text-sm text-gray-500 mb-6">
        Active clusters become articles when their source count reaches {project.articleMinSources}.
        Force-generate an article on demand:{" "}
        <code className="bg-gray-100 px-1 rounded">docker compose --profile manual run --rm bot python -m main_full</code>
      </p>
      <ClustersTable initial={rows.map((c) => ({
        ...c,
        lastSourceAddedAt: c.lastSourceAddedAt.toISOString(),
      }))} />
    </section>
  );
}
