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
            <button className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]">
              Compile Dossier
            </button>
          </form>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Project Detail
          </Link>
          <Link
            href="/thesis"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Open Thesis
          </Link>
        </div>
      }
    />
  );
}
