import Link from "next/link";
import { notFound } from "next/navigation";
import { compileProjectCatalystsAction } from "@/app/(workspace)/actions";
import { CatalystView } from "@/components/workspace/catalyst-view";
import { getCatalystsPageData, getProjectDetailData } from "@/lib/services/workspace-service";

export default async function ProjectCatalystsPage({
  params,
}: Readonly<{
  params: Promise<{ projectId: string }>;
}>) {
  const { projectId } = await params;
  const [projectData, catalystData] = await Promise.all([
    getProjectDetailData(projectId),
    getCatalystsPageData(projectId),
  ]);

  if (!projectData || !catalystData) {
    notFound();
  }

  return (
    <CatalystView
      data={catalystData}
      eyebrow="Project Catalysts"
      title={`${projectData.summary.project.name} Catalysts`}
      description={`This catalyst tracker is scoped to ${projectData.summary.project.name}. It compiles first-class catalyst objects from current thesis, timeline, claims, contradictions, and supporting sources.`}
      thesisPath={`/projects/${projectId}/thesis`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileProjectCatalystsAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/projects/${projectId}/catalysts`}
            />
            <button className="action-button-primary">
              Refresh Catalysts
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
