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
            <button className="action-button-primary">
              Run Monitoring
            </button>
          </form>
          <form action={compileActiveProjectThesisAction}>
            <button className="action-button-secondary">
              Refresh Thesis
            </button>
          </form>
          <form action={runActiveProjectContradictionAnalysisAction}>
            <button className="action-button-secondary">
              Re-Run Contradictions
            </button>
          </form>
          <form action={compileActiveProjectTimelineAction}>
            <button className="action-button-secondary">
              Rebuild Timeline
            </button>
          </form>
          <Link
            href="/sources"
            className="action-button-secondary"
          >
            Review Sources
          </Link>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="action-button-secondary"
          >
            Open Command View
          </Link>
        </div>
      }
    />
  );
}
