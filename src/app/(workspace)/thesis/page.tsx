import Link from "next/link";
import { compileActiveProjectThesisAction } from "@/app/(workspace)/actions";
import { ThesisView } from "@/components/workspace/thesis-view";
import { getActiveProjectId, getThesisPageData } from "@/lib/services/workspace-service";

export default async function ThesisPage() {
  const projectId = await getActiveProjectId();
  const data = await getThesisPageData(projectId);

  if (!data) {
    throw new Error("Active project thesis data is unavailable.");
  }

  return (
    <ThesisView
      data={data}
      eyebrow="Thesis Layer"
      title="Investment Thesis"
      description={`The thesis tracker compiles a source-grounded thesis for ${data.summary.project.name} from canon, claims, timeline state, contradictions, and durable research outputs.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileActiveProjectThesisAction}>
            <button className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]">
              Compile Thesis
            </button>
          </form>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Project Detail
          </Link>
          <Link
            href="/contradictions"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Open Contradictions
          </Link>
        </div>
      }
    />
  );
}
