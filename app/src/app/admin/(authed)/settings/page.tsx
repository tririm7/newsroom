import { PasswordForm } from "@/components/admin/PasswordForm";
import { ProjectSettingsForm } from "@/components/admin/ProjectSettingsForm";
import { getCurrentProject, SUPPORTED_LOCALES } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const project = await getCurrentProject();
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Slug: <code>{project.slug}</code> · Domain: <code>{project.domain}</code>
      </p>

      <h2 className="text-lg font-medium mb-3">Project</h2>
      <ProjectSettingsForm
        locales={[...SUPPORTED_LOCALES]}
        initial={{
          name: project.name,
          description: project.description,
          brandName: project.brandName,
          brandSuffix: project.brandSuffix,
          brandColor: project.brandColor,
          brandColorHover: project.brandColorHover,
          primaryLocale: project.primaryLocale,
          timezone: project.timezone,
          articleMinSources: project.articleMinSources,
          maxNewsAgeHours: project.maxNewsAgeHours,
          clusterInactivityHours: project.clusterInactivityHours,
          ingestionCron: project.ingestionCron,
          generationCron: project.generationCron,
          autoPublish: project.autoPublish,
        }}
      />

      <h2 className="text-lg font-medium mt-10 mb-3">Change admin password</h2>
      <PasswordForm />
    </section>
  );
}
