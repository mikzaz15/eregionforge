import Link from "next/link";
import { MetricCard, PageFrame, SectionCard } from "@/components/workspace/primitives";
import { getActiveProjectId, getSettingsPageData, settingsGroups } from "@/lib/services/workspace-service";

export default async function SettingsPage() {
  const projectId = await getActiveProjectId();
  const data = await getSettingsPageData(projectId);

  if (!data) {
    throw new Error("Active project settings data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Control Layer"
      title="Settings"
      description={`Settings establish the persistence and service boundaries for ${data.summary.project.name} while keeping the compiled wiki at the center.`}
      actions={
        <Link
          href={`/projects/${data.summary.project.id}`}
          className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
        >
          View Project
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {settingsGroups.map((group) => (
          <SectionCard
            key={group.title}
            eyebrow={group.eyebrow}
            title={group.title}
            description={group.description}
          >
            <div className="space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                >
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
    </PageFrame>
  );
}
