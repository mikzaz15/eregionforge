import Link from "next/link";
import { compileActiveProjectCatalystsAction } from "@/app/(workspace)/actions";
import { CatalystView } from "@/components/workspace/catalyst-view";
import { getActiveProjectId, getCatalystsPageData } from "@/lib/services/workspace-service";

export default async function CatalystsPage() {
  const projectId = await getActiveProjectId();
  const data = await getCatalystsPageData(projectId);

  if (!data) {
    throw new Error("Active project catalyst data is unavailable.");
  }

  return (
    <CatalystView
      data={data}
      eyebrow="Catalyst Layer"
      title="Catalyst Tracker"
      description={`The catalyst tracker compiles source-grounded catalyst objects for ${data.summary.project.name} and connects them to thesis, timeline, contradictions, and supporting evidence.`}
      thesisPath={`/projects/${data.summary.project.id}/thesis`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileActiveProjectCatalystsAction}>
            <button className="action-button-primary">
              Refresh Catalysts
            </button>
          </form>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="action-button-secondary"
          >
            Open Command View
          </Link>
          <Link
            href="/thesis"
            className="action-button-secondary"
          >
            Open Thesis
          </Link>
          <Link
            href="/monitoring"
            className="action-button-secondary"
          >
            Review Alerts
          </Link>
        </div>
      }
    />
  );
}
