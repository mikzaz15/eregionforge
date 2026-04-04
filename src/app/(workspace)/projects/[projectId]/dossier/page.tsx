import Link from "next/link";
import { notFound } from "next/navigation";
import { compileProjectDossierAction } from "@/app/(workspace)/actions";
import { DossierView } from "@/components/workspace/dossier-view";
import { getDossierPageData, getProjectDetailData } from "@/lib/services/workspace-service";

export default async function ProjectDossierPage({
  params,
}: Readonly<{
  params: Promise<{ projectId: string }>;
}>) {
  const { projectId } = await params;
  const [projectData, dossierData] = await Promise.all([
    getProjectDetailData(projectId),
    getDossierPageData(projectId),
  ]);

  if (!projectData || !dossierData) {
    notFound();
  }

  return (
    <DossierView
      data={dossierData}
      eyebrow="Project Dossier"
      title={`${projectData.summary.project.name} Dossier`}
      description={`This dossier view is scoped to ${projectData.summary.project.name}. It compiles a structured, source-grounded research dossier from the current project knowledge stack.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileProjectDossierAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/projects/${projectId}/dossier`}
            />
            <button className="action-button-primary">
              Refresh Dossier
            </button>
          </form>
          <Link
            href={`/projects/${projectId}`}
            className="action-button-secondary"
          >
            Open Command View
          </Link>
          <Link
            href={`/projects/${projectId}/thesis`}
            className="action-button-secondary"
          >
            Open Thesis
          </Link>
        </div>
      }
    />
  );
}
