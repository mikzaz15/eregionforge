import Link from "next/link";
import { compileActiveProjectDossierAction } from "@/app/(workspace)/actions";
import { DossierView } from "@/components/workspace/dossier-view";
import { getActiveProjectId, getDossierPageData } from "@/lib/services/workspace-service";

export default async function DossierPage() {
  const projectId = await getActiveProjectId();
  const data = await getDossierPageData(projectId);

  if (!data) {
    throw new Error("Active project dossier data is unavailable.");
  }

  return (
    <DossierView
      data={data}
      eyebrow="Dossier Layer"
      title="Company Dossier"
      description={`The dossier compiles a structured research view for ${data.summary.project.name} from canonical pages, claims, sources, artifacts, and thesis context where useful.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileActiveProjectDossierAction}>
            <button className="action-button-primary">
              Refresh Dossier
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
            Open Monitoring
          </Link>
          <Link
            href="/entities"
            className="action-button-secondary"
          >
            Open Entities
          </Link>
        </div>
      }
    />
  );
}
