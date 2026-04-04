import Link from "next/link";
import { notFound } from "next/navigation";
import { compileProjectThesisAction } from "@/app/(workspace)/actions";
import { ThesisView } from "@/components/workspace/thesis-view";
import { getProjectDetailData, getThesisPageData } from "@/lib/services/workspace-service";

export default async function ProjectThesisPage({
  params,
}: Readonly<{
  params: Promise<{ projectId: string }>;
}>) {
  const { projectId } = await params;
  const [projectData, thesisData] = await Promise.all([
    getProjectDetailData(projectId),
    getThesisPageData(projectId),
  ]);

  if (!projectData || !thesisData) {
    notFound();
  }

  return (
    <ThesisView
      data={thesisData}
      eyebrow="Project Thesis"
      title={`${projectData.summary.project.name} Thesis`}
      description={`This thesis view is scoped to ${projectData.summary.project.name}. It compiles current project knowledge into an investment-style stance and tracking surface without leaving the canonical stack.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileProjectThesisAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/projects/${projectId}/thesis`}
            />
            <button className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]">
              Refresh Thesis
            </button>
          </form>
          <Link
            href={`/projects/${projectId}`}
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Project Detail
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Back To Projects
          </Link>
        </div>
      }
    />
  );
}
