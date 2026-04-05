import { StatusPill, type StatusTone } from "@/components/workspace/primitives";
import type { ConfidenceFactor } from "@/lib/services/confidence-model-v2";

function factorTone(factor: ConfidenceFactor): StatusTone {
  if (factor.direction === "limiting") {
    return factor.strength >= 0.6 ? "danger" : "accent";
  }

  return factor.strength >= 0.55 ? "success" : "neutral";
}

export function ConfidenceExplainer({
  summary,
  factors,
  className = "",
}: Readonly<{
  summary: string | null | undefined;
  factors: ConfidenceFactor[];
  className?: string;
}>) {
  if (!summary && factors.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 ${className}`.trim()}
    >
      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        Confidence influenced by
      </p>
      {summary ? (
        <p className="mt-3 text-sm leading-6 text-foreground">{summary}</p>
      ) : null}
      {factors.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {factors.map((factor) => (
            <StatusPill key={`${factor.key}-${factor.direction}`} tone={factorTone(factor)}>
              {factor.label}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </div>
  );
}
