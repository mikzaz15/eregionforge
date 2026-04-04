import Link from "next/link";
import {
  compileActiveProjectThesisAction,
  compileActiveProjectTimelineAction,
  runActiveProjectContradictionAnalysisAction,
  runActiveProjectMonitoringAnalysisAction,
} from "@/app/(workspace)/actions";
import { MonitoringView } from "@/components/workspace/monitoring-view";
import {
  getActiveProjectId,
  getMonitoringPageData,
} from "@/lib/services/workspace-service";

export default async function MonitoringPage() {
  const projectId = await getActiveProjectId();
  const data = await getMonitoringPageData(projectId);

  if (!data) {
    throw new Error("Active project monitoring data is unavailable.");
  }

  return (
    <MonitoringView
      data={data}
      eyebrow="Freshness Layer"
      title="Source Monitoring"
      description={`Monitoring tracks whether ${data.summary.project.name} has newer knowledge inputs that may leave thesis, dossier, catalysts, chronology, or contradiction analysis behind the current research state.`}
      sourcesPath="/sources"
      thesisPath="/thesis"
      dossierPath="/dossier"
      catalystsPath="/catalysts"
      timelinePath="/timeline"
      contradictionsPath="/contradictions"
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={runActiveProjectMonitoringAnalysisAction}>
            <button className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]">
              Run Monitoring
            </button>
          </form>
          <form action={compileActiveProjectThesisAction}>
            <button className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
              Refresh Thesis
            </button>
          </form>
          <form action={runActiveProjectContradictionAnalysisAction}>
            <button className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
              Re-Run Contradictions
            </button>
          </form>
          <form action={compileActiveProjectTimelineAction}>
            <button className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
              Rebuild Timeline
            </button>
          </form>
          <Link
            href="/sources"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Review Sources
          </Link>
        </div>
      }
    />
  );
}
