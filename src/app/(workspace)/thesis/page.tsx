import Link from "next/link";
import { compileActiveProjectThesisAction } from "@/app/(workspace)/actions";
import { ThesisView } from "@/components/workspace/thesis-view";
import { getActiveProjectId, getThesisPageData } from "@/lib/services/workspace-service";

function getRevisionId(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function ThesisPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ revisionId?: string | string[] }>;
}>) {
  const projectId = await getActiveProjectId();
  const { revisionId } = await searchParams;
  const data = await getThesisPageData(projectId, getRevisionId(revisionId));

  if (!data) {
    throw new Error("Active project thesis data is unavailable.");
  }

  return (
    <ThesisView
      data={data}
      eyebrow="Thesis Layer"
      title="Investment Thesis"
      description={`The thesis tracker compiles a source-grounded thesis for ${data.summary.project.name} from canon, claims, timeline state, contradictions, and durable research outputs.`}
      basePath="/thesis"
      catalystsPath="/catalysts"
      monitoringPath="/monitoring"
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileActiveProjectThesisAction}>
            <button className="action-button-primary">
              Refresh Thesis
            </button>
          </form>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="action-button-secondary"
          >
            Open Command View
          </Link>
          <Link
            href="/contradictions"
            className="action-button-secondary"
          >
            Open Contradictions
          </Link>
          <Link
            href="/monitoring"
            className="action-button-secondary"
          >
            Open Monitoring
          </Link>
          <Link
            href="/catalysts"
            className="action-button-secondary"
          >
            Open Catalysts
          </Link>
        </div>
      }
    />
  );
}
