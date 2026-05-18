import { getDashboardStats, getLastBotRun } from "@/lib/admin/queries";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const project = await getCurrentProject();
  const stats = await getDashboardStats(project.id);
  const lastRun = await getLastBotRun(project.id);

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-1">{project.name}</h1>
      <p className="text-sm text-gray-500 mb-6">{project.domain} · locale={project.primaryLocale}</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Sources"
          value={`${stats.sources_active} / ${stats.sources_total}`}
          sub="active / total"
        />
        <StatCard label="Items (24h)" value={stats.items_24h} />
        <StatCard label="Active clusters" value={stats.clusters_active} />
        <StatCard
          label="Articles published"
          value={stats.articles_total}
          sub={`${stats.articles_24h} in last 24h`}
        />
        <StatCard
          label="Last bot run"
          value={lastRun ? `${lastRun.type} · ${lastRun.status}` : "—"}
          sub={lastRun?.finishedAt ? lastRun.finishedAt.toISOString().slice(0, 19).replace("T", " ") + " UTC" : undefined}
        />
      </div>

      <div className="mt-8 text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-2">Useful commands</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code className="bg-gray-100 px-1 rounded">docker compose logs -f bot-cron</code> — follow scheduler output</li>
          <li><code className="bg-gray-100 px-1 rounded">docker compose --profile manual run --rm bot python -m main_full</code> — trigger a full pipeline run on demand</li>
        </ul>
      </div>
    </section>
  );
}
