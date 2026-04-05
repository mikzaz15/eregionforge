import Link from "next/link";
import { MarkdownDocument } from "@/components/workspace/markdown-document";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import {
  runAskSessionAction,
  saveAskSessionAsArtifactAction,
} from "@/app/(workspace)/actions";
import {
  askAnswerModes,
  getActiveProjectId,
  getAskPageDataWithSession,
  retrievalPolicy,
} from "@/lib/services/workspace-service";
import {
  artifactProvenanceLabel,
  artifactTypeLabel,
} from "@/lib/services/artifact-service";

function confidenceTone(confidence: string): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function claimTone(status: string): StatusTone {
  if (status === "supported") {
    return "success";
  }

  if (status === "weak-support") {
    return "accent";
  }

  if (status === "unresolved") {
    return "danger";
  }

  return "neutral";
}

function artifactTone(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

const defaultPrompt =
  "What is the current underwriting case on Northstar, and what could break it over the next two quarters?";

export default async function AskPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ sessionId?: string; savedArtifactId?: string }>;
}>) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const projectId = await getActiveProjectId();
  const data = await getAskPageDataWithSession(
    projectId,
    resolvedSearchParams.sessionId,
    resolvedSearchParams.savedArtifactId,
  );

  if (!data) {
    throw new Error("Active project ask data is unavailable.");
  }

  const currentSession = data.currentSession;

  return (
    <PageFrame
      eyebrow="Question Layer"
      title="Ask"
      description={`Ask mode runs against compiled knowledge for ${data.summary.project.name}. Retrieval begins with canonical pages, then claims and evidence, and only falls back to raw sources when the wiki is thin.`}
      actions={
        <div className="flex flex-wrap gap-3">
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
            href="/artifacts"
            className="action-button-secondary"
          >
            Artifact Ledger
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {data.savedArtifact ? (
        <div className="rounded-[1.75rem] border border-border bg-[rgba(255,255,255,0.42)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone="success">artifact saved</StatusPill>
            <p className="text-sm leading-6 text-foreground">
              Saved as <span className="font-semibold">{data.savedArtifact.title}</span> in the
              project artifact ledger.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          eyebrow="Query Console"
          title="Run against compiled knowledge"
          description="This form executes a project-scoped ask session, stores the result, and makes the consulted objects inspectable."
        >
          <form action={runAskSessionAction} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-[1.5rem] border border-border bg-background/70 p-4">
                <label
                  htmlFor="ask-prompt"
                  className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
                >
                  Research question
                </label>
                <textarea
                  id="ask-prompt"
                  name="prompt"
                  className="mt-3 min-h-44 w-full resize-none rounded-[1.35rem] border border-border bg-surface px-4 py-4 text-sm leading-7 text-foreground outline-none transition focus:border-border-strong"
                  defaultValue={currentSession?.session.prompt ?? defaultPrompt}
                />
              </div>
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-border bg-background/70 p-4">
                  <label
                    htmlFor="answer-mode"
                    className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
                  >
                    Answer mode
                  </label>
                  <select
                    id="answer-mode"
                    name="answerMode"
                    defaultValue={currentSession?.session.answerMode ?? "concise-answer"}
                    className="mt-3 w-full rounded-[1.1rem] border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-border-strong"
                  >
                    {askAnswerModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {
                      askAnswerModes.find(
                        (mode) =>
                          mode.value ===
                          (currentSession?.session.answerMode ?? "concise-answer"),
                      )?.description
                    }
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border bg-background/70 p-4">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Retrieval order
                  </p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-muted">
                    {retrievalPolicy.map((item, index) => (
                      <p key={item.title}>
                        <span className="font-semibold text-foreground">{index + 1}.</span>{" "}
                        {item.title}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="action-button-primary">
                Run Ask Session
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          eyebrow="Session Ledger"
          title="Recent ask sessions"
          description="Ask sessions become project memory only after they resolve against the canonical stack."
        >
          <div className="space-y-3">
            {data.recentSessions.length > 0 ? (
              data.recentSessions.map((entry) => (
                <Link
                  key={entry.session.id}
                  href={`/ask?sessionId=${entry.session.id}`}
                  className="block rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 transition hover:bg-background/80"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold tracking-tight text-foreground">
                      {entry.session.prompt}
                    </p>
                    <StatusPill tone={confidenceTone(entry.session.confidence)}>
                      {entry.session.confidence}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {entry.session.metadata?.answerModeLabel ?? entry.session.answerMode}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Wiki {entry.consultedWikiPageCount} · Claims {entry.consultedClaimCount} · Sources {entry.consultedSourceCount}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                No ask sessions exist yet for this project.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <SectionCard
          eyebrow="Answer"
          title={currentSession ? "Current session output" : "Awaiting session"}
          description="Answers are rendered as research outputs, not chat bubbles, and always carry a visible evidence posture."
        >
          {currentSession ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill tone={confidenceTone(currentSession.session.confidence)}>
                    {currentSession.session.confidence}
                  </StatusPill>
                  <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    {currentSession.session.metadata?.answerModeLabel ??
                      currentSession.session.answerMode}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  {currentSession.session.prompt}
                </p>
                {currentSession.session.metadata?.confidenceSummary ? (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {currentSession.session.metadata.confidenceSummary}
                  </p>
                ) : null}
              </div>
              <MarkdownDocument content={currentSession.session.answer} />
              <form
                action={saveAskSessionAsArtifactAction}
                className="rounded-2xl border border-border bg-background/70 px-4 py-4"
              >
                <input type="hidden" name="sessionId" value={currentSession.session.id} />
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-end">
                  <div>
                    <label
                      htmlFor="artifact-type"
                      className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
                    >
                      Save as artifact
                    </label>
                    <select
                      id="artifact-type"
                      name="artifactType"
                      defaultValue="saved_answer"
                      className="mt-3 w-full rounded-[1.1rem] border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-border-strong"
                    >
                      {data.artifactTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button className="action-button-secondary">
                      Save As Artifact
                    </button>
                    <Link
                      href={
                        data.savedArtifact
                          ? `/artifacts/${data.savedArtifact.id}`
                          : "/artifacts"
                      }
                      className="action-button-secondary"
                    >
                      {data.savedArtifact ? "Open Saved Artifact" : "Open Artifacts"}
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
              Run a project-scoped ask session to generate an answer over compiled canon.
            </div>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            eyebrow="Consulted Objects"
            title="What the system used"
            description="Visibility into consulted pages, claims, and sources is mandatory so Ask mode remains inspectable."
          >
            {currentSession ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                  <div className="flex flex-wrap gap-4 text-sm text-muted">
                    <span>Wiki pages: {currentSession.consultedPages.length}</span>
                    <span>Claims: {currentSession.consultedClaims.length}</span>
                    <span>Sources: {currentSession.consultedSources.length}</span>
                    <span>Evidence: {currentSession.consultedEvidenceHighlights.length}</span>
                    <span>Confidence: {currentSession.session.confidence}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 space-y-2">
                  {currentSession.session.metadata?.consultedObjectSummary ? (
                    <p className="text-sm leading-6 text-foreground">
                      {currentSession.session.metadata.consultedObjectSummary}
                    </p>
                  ) : null}
                  {currentSession.session.metadata?.trustSummary ? (
                    <p className="text-sm leading-6 text-muted">
                      {currentSession.session.metadata.trustSummary}
                    </p>
                  ) : null}
                  {currentSession.session.metadata?.tensionSummary ? (
                    <p className="text-sm leading-6 text-muted">
                      {currentSession.session.metadata.tensionSummary}
                    </p>
                  ) : null}
                  {currentSession.session.metadata?.freshnessCaveat ? (
                    <p className="text-sm leading-6 text-muted">
                      {currentSession.session.metadata.freshnessCaveat}
                    </p>
                  ) : null}
                  {currentSession.session.metadata?.lineageSummary ? (
                    <p className="text-sm leading-6 text-muted">
                      {currentSession.session.metadata.lineageSummary}
                    </p>
                  ) : null}
                  {currentSession.session.metadata?.evidenceLineageSummary ? (
                    <p className="text-sm leading-6 text-muted">
                      {currentSession.session.metadata.evidenceLineageSummary}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Derived Intelligence
                  </p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Catalysts and timeline
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {currentSession.relatedCatalysts.map((entry) => (
                          <Link
                            key={entry.catalyst.id}
                            href={`/catalysts#${entry.catalyst.id}`}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.catalyst.title}
                          </Link>
                        ))}
                        {currentSession.relatedTimelineEvents.map((entry) => (
                          <Link
                            key={entry.event.id}
                            href={`/timeline#${entry.event.id}`}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.event.title}
                          </Link>
                        ))}
                        {currentSession.relatedCatalysts.length === 0 &&
                        currentSession.relatedTimelineEvents.length === 0 ? (
                          <p className="text-muted">No derived timing objects were consulted.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Tension and entities
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {currentSession.relatedContradictions.map((entry) => (
                          <Link
                            key={entry.contradiction.id}
                            href={`/contradictions#${entry.contradiction.id}`}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.contradiction.title}
                          </Link>
                        ))}
                        {currentSession.relatedEntities.map((entry) => (
                          <Link
                            key={entry.entity.id}
                            href={`/entities#${entry.entity.id}`}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.entity.canonicalName}
                          </Link>
                        ))}
                        {currentSession.relatedAlerts.map((entry) => (
                          <Link
                            key={entry.alert.id}
                            href="/monitoring"
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.alert.title}
                          </Link>
                        ))}
                        {currentSession.relatedContradictions.length === 0 &&
                        currentSession.relatedEntities.length === 0 &&
                        currentSession.relatedAlerts.length === 0 ? (
                          <p className="text-muted">No derived tension objects were consulted.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Evidence Fragments
                  </p>
                  {currentSession.consultedEvidenceHighlights.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {currentSession.consultedEvidenceHighlights.map((entry) => (
                        <Link
                          key={entry.fragment.id}
                          href={`/sources#${entry.fragment.sourceId}`}
                          className="block rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 transition hover:bg-background"
                        >
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {entry.source?.title ?? "Source fragment"}
                          </p>
                          {entry.claim ? (
                            <p className="mt-2 text-xs leading-5 text-muted">
                              Claim: {entry.claim.text}
                            </p>
                          ) : null}
                          <p className="mt-3 text-sm leading-6 text-foreground">
                            {entry.snippet}
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted">
                      No specific evidence fragments were isolated for this ask session.
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Wiki Pages
                  </p>
                  {currentSession.consultedPages.length > 0 ? (
                    currentSession.consultedPages.map((entry) => (
                      <Link
                        key={entry.page.id}
                        href={`/wiki/${entry.page.id}`}
                        className="block rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-semibold tracking-tight text-foreground">
                            {entry.page.title}
                          </p>
                          <StatusPill tone={entry.page.status === "active" ? "success" : "accent"}>
                            {entry.page.status}
                          </StatusPill>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {entry.currentRevision?.summary}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-muted">No wiki pages were consulted.</p>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Claims
                  </p>
                  {currentSession.consultedClaims.length > 0 ? (
                    currentSession.consultedClaims.map((entry) => (
                      <div
                        key={entry.claim.id}
                        className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill tone={claimTone(entry.claim.supportStatus)}>
                            {entry.claim.supportStatus}
                          </StatusPill>
                          {entry.page ? (
                            <Link
                              href={`/wiki/${entry.page.id}`}
                              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 hover:underline"
                            >
                              {entry.page.title}
                            </Link>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-foreground">
                          {entry.claim.text}
                        </p>
                        {entry.page ? (
                          <Link
                            href={`/wiki/${entry.page.id}`}
                            className="mt-3 inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                          >
                            Open claim context
                          </Link>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-muted">No claims were consulted.</p>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Sources
                  </p>
                  {currentSession.consultedSources.length > 0 ? (
                    currentSession.consultedSources.map((entry) => (
                      <div
                        key={entry.source.id}
                        className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
                      >
                        <p className="font-semibold tracking-tight text-foreground">
                          {entry.source.title}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          <span>{entry.source.sourceType}</span>
                          <span>{entry.source.status}</span>
                          <span>{entry.fragmentCount} fragments</span>
                        </div>
                        {entry.excerpt ? (
                          <p className="mt-3 text-sm leading-6 text-muted">{entry.excerpt}</p>
                        ) : null}
                        <Link
                          href="/sources"
                          className="mt-3 inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                          Open sources ledger
                        </Link>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-muted">No sources were consulted.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                Consulted-object visibility appears after the first ask session is run.
              </p>
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Artifact Targets"
            title="Recent durable outputs"
            description="Ask responses should graduate into artifacts when they are worth preserving."
          >
            <div className="space-y-3">
              {data.artifacts.map((entry) => (
                <Link
                  key={entry.artifact.id}
                  href={`/artifacts/${entry.artifact.id}`}
                  className="block rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 transition hover:bg-background"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold tracking-tight text-foreground">
                      {entry.artifact.title}
                    </p>
                    <StatusPill tone={artifactTone(entry.artifact.status)}>
                      {entry.artifact.status}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {entry.artifact.previewText}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {artifactTypeLabel(entry.artifact.artifactType)} · {artifactProvenanceLabel(entry.artifact.provenance)}
                  </p>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </PageFrame>
  );
}
