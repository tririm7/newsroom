import { PasswordForm } from "@/components/admin/PasswordForm";
import { getCurrentProject } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const project = await getCurrentProject();
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>

      <h2 className="text-lg font-medium mb-2">Project</h2>
      <dl className="text-sm grid grid-cols-[180px_1fr] gap-y-1 mb-8">
        <dt className="text-gray-500">Slug</dt><dd>{project.slug}</dd>
        <dt className="text-gray-500">Name</dt><dd>{project.name}</dd>
        <dt className="text-gray-500">Domain</dt><dd>{project.domain}</dd>
        <dt className="text-gray-500">Primary locale</dt><dd>{project.primaryLocale}</dd>
        <dt className="text-gray-500">Timezone</dt><dd>{project.timezone}</dd>
        <dt className="text-gray-500">Brand color</dt><dd>
          <span className="inline-block w-3 h-3 mr-2 align-middle rounded-sm" style={{ background: project.brandColor }} />
          <code>{project.brandColor}</code>
        </dd>
        <dt className="text-gray-500">Article min sources</dt><dd>{project.articleMinSources}</dd>
        <dt className="text-gray-500">Max news age (h)</dt><dd>{project.maxNewsAgeHours}</dd>
        <dt className="text-gray-500">Cluster inactivity (h)</dt><dd>{project.clusterInactivityHours}</dd>
      </dl>
      <p className="text-xs text-gray-500 mb-8">
        Project knobs (branding, thresholds, cron) are editable via SQL in v0.1.
        A UI editor lands in v0.2.
      </p>

      <h2 className="text-lg font-medium mb-2">Change admin password</h2>
      <PasswordForm />
    </section>
  );
}
