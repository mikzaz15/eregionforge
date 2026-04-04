import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarNav } from "@/components/workspace/sidebar-nav";
import { workspaceNavigation } from "@/lib/navigation";
import { getShellData } from "@/lib/services/workspace-service";

function compileTone(status: string) {
  if (status === "completed") {
    return "text-success";
  }

  if (status === "running") {
    return "text-accent";
  }

  if (status === "failed") {
    return "text-danger";
  }

  return "text-muted";
}

function nextAction(summary: Awaited<ReturnType<typeof getShellData>>["activeSummary"]) {
  if (summary.freshnessAlertCount > 0 || summary.thesisPotentiallyStale) {
    return {
      href: "/monitoring",
      label: "Review freshness alerts",
      detail: "New source or analysis changes may have outpaced the current thesis stack.",
    };
  }

  if (!summary.dossierCompanyName) {
    return {
      href: "/dossier",
      label: "Compile the dossier",
      detail: "Turn the current canon into a structured company view.",
    };
  }

  return {
    href: "/thesis",
    label: "Open the thesis",
    detail: "Start the demo from the current underwriting view and follow the references outward.",
  };
}

export async function AppShell({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { activeSummary, projectSummaries, statusNote } = await getShellData();
  const recommendedAction = nextAction(activeSummary);

  return (
    <div className="min-h-screen px-4 py-4 lg:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1680px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="surface-panel relative overflow-hidden rounded-[2rem] px-5 py-5 lg:px-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <div className="flex h-full flex-col gap-8">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="mono-label text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
                    EregionForge
                  </p>
                  <h1 className="display-title text-3xl leading-none tracking-tight text-foreground">
                    Research
                    <br />
                    canon, compiled.
                  </h1>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-strong bg-accent-soft mono-label text-sm font-semibold tracking-[0.24em] text-accent">
                  EF
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border bg-background/70 p-4">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Loaded project
                </p>
                <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                  {activeSummary.project.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {activeSummary.project.description}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Domain
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {activeSummary.project.domain}
                    </p>
                  </div>
                  <div>
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Compile
                    </p>
                    <p
                      className={`mt-2 text-sm font-medium capitalize ${compileTone(activeSummary.latestCompileStatus)}`}
                    >
                      {activeSummary.latestCompileStatus}
                    </p>
                  </div>
                  <div>
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Thesis
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {activeSummary.thesisStance ?? "Not compiled"}
                    </p>
                  </div>
                  <div>
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Dossier
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {activeSummary.dossierCompanyName ? "Ready" : "Missing"}
                    </p>
                  </div>
                  <div>
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Alerts
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {activeSummary.freshnessAlertCount}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Next best action
                  </p>
                  <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">
                    {recommendedAction.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {recommendedAction.detail}
                  </p>
                  <Link
                    href={recommendedAction.href}
                    className="action-button-secondary action-button-compact mt-4"
                  >
                    Open
                  </Link>
                </div>
                <Link
                  href={`/projects/${activeSummary.project.id}`}
                  className="action-button-secondary action-button-compact mt-4"
                >
                  Open Command View
                </Link>
              </div>
            </div>

            <SidebarNav items={workspaceNavigation} />

            <div className="space-y-2">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Portfolio
              </p>
              {projectSummaries.map((summary) => (
                <Link
                  key={summary.project.id}
                  href={`/projects/${summary.project.id}`}
                  className={`block rounded-[1.35rem] border px-4 py-3 transition ${
                    summary.project.id === activeSummary.project.id
                      ? "border-border-strong bg-background/80"
                      : "border-border bg-background/55 hover:bg-background/75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold tracking-tight text-foreground">
                        {summary.project.name}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {summary.project.domain}
                      </p>
                    </div>
                    <span
                      className={`mono-label text-[11px] uppercase tracking-[0.24em] ${compileTone(summary.latestCompileStatus)}`}
                    >
                      {summary.latestCompileStatus}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-auto rounded-[1.75rem] border border-border bg-[rgba(23,26,29,0.94)] px-4 py-4 text-stone-50">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-stone-400">
                Product principle
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-200">
                The compiled wiki is the center of the product. Ask flows and artifacts
                should resolve against canon, claims, and evidence before touching raw
                source fragments.
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-400">{statusNote}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
                <span>Sources</span>
                <span className="h-px flex-1 bg-stone-700" />
                <span>Wiki</span>
                <span className="h-px flex-1 bg-stone-700" />
                <span>Artifacts</span>
              </div>
              <Link
                href="/wiki"
                className="action-button-primary action-button-compact mt-4 border-stone-700 bg-stone-900 text-stone-100 hover:border-stone-500 hover:bg-stone-800"
              >
                Open Canon
              </Link>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="surface-panel rounded-[2rem] px-5 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Workspace status
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {activeSummary.project.name}
                  </h2>
                  <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted">
                    Active project workspace
                  </span>
                </div>
                <p className="text-sm leading-6 text-muted">
                  {activeSummary.project.name} is loaded as the active research workspace. Thesis, dossier, catalysts, contradictions, monitoring, ask, and artifacts all resolve against this project.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Sources
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {activeSummary.sourceCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Wiki
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {activeSummary.wikiPageCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Thesis
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {activeSummary.thesisStance ?? "None"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Catalysts
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {activeSummary.catalystCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Alerts
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {activeSummary.freshnessAlertCount}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="surface-panel min-h-[640px] rounded-[2rem] p-5 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
