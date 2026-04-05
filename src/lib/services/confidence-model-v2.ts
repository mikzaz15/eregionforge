import type { RevisionConfidence } from "@/lib/domain/types";
import {
  confidenceLabelFromScore,
  deriveConfidenceScore,
} from "@/lib/services/semantic-intelligence-v1";

export type ConfidenceFactorKey =
  | "support_density"
  | "source_diversity"
  | "contradiction_burden"
  | "freshness_burden"
  | "entity_clarity"
  | "date_precision"
  | "stale_posture"
  | "review_posture";

export type ConfidenceFactorDirection = "supporting" | "limiting";

export type ConfidenceFactor = {
  key: ConfidenceFactorKey;
  label: string;
  direction: ConfidenceFactorDirection;
  strength: number;
  detail: string;
};

export type ConfidenceAssessment = {
  score: number;
  label: RevisionConfidence;
  factors: ConfidenceFactor[];
  summary: string;
};

type ConfidenceAssessmentInput = {
  supportDensity: number;
  sourceDiversityCount: number;
  contradictionBurden?: number;
  freshnessBurden?: number;
  entityClarity?: number;
  datePrecision?: number;
  stalePosture?: number;
  reviewPosture?: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

function roundStrength(value: number): number {
  return Math.round(clamp(value) * 100) / 100;
}

function factorLabel(key: ConfidenceFactorKey): string {
  switch (key) {
    case "support_density":
      return "support density";
    case "source_diversity":
      return "source diversity";
    case "contradiction_burden":
      return "contradiction burden";
    case "freshness_burden":
      return "freshness burden";
    case "entity_clarity":
      return "entity clarity";
    case "date_precision":
      return "date precision";
    case "stale_posture":
      return "stale posture";
    case "review_posture":
      return "review posture";
  }
}

function summarizeFactorLabels(factors: ConfidenceFactor[]): string {
  if (factors.length === 0) {
    return "";
  }

  const labels = factors.map((factor) => factor.label);

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function supportingFactor(
  key: ConfidenceFactorKey,
  strength: number,
  detail: string,
): ConfidenceFactor | null {
  if (strength <= 0) {
    return null;
  }

  return {
    key,
    label: factorLabel(key),
    direction: "supporting",
    strength: roundStrength(strength),
    detail,
  };
}

function limitingFactor(
  key: ConfidenceFactorKey,
  strength: number,
  detail: string,
): ConfidenceFactor | null {
  if (strength <= 0) {
    return null;
  }

  return {
    key,
    label: factorLabel(key),
    direction: "limiting",
    strength: roundStrength(strength),
    detail,
  };
}

function supportDensityFactor(value: number): ConfidenceFactor {
  if (value >= 0.72) {
    return supportingFactor(
      "support_density",
      value,
      "Support density is strong across the linked claims and evidence.",
    )!;
  }

  if (value >= 0.42) {
    return supportingFactor(
      "support_density",
      value,
      "Support density is present, but some sections still rely on mixed or incomplete support.",
    )!;
  }

  return limitingFactor(
    "support_density",
    1 - value,
    "Support density remains thin or unresolved relative to the current surface.",
  )!;
}

function sourceDiversityFactor(count: number): ConfidenceFactor {
  if (count >= 4) {
    return supportingFactor(
      "source_diversity",
      Math.min(count / 5, 1),
      "Evidence is drawn from multiple distinct sources rather than one narrow narrative.",
    )!;
  }

  if (count >= 2) {
    return supportingFactor(
      "source_diversity",
      Math.min(count / 4, 1),
      "Source diversity is present, but the supporting base could still broaden.",
    )!;
  }

  return limitingFactor(
    "source_diversity",
    0.7,
    "Confidence still leans on a narrow source base.",
  )!;
}

function contradictionBurdenFactor(value: number): ConfidenceFactor {
  if (value >= 0.66) {
    return limitingFactor(
      "contradiction_burden",
      value,
      "Unresolved contradiction burden is materially limiting confidence.",
    )!;
  }

  if (value >= 0.3) {
    return limitingFactor(
      "contradiction_burden",
      value,
      "Some unresolved contradiction burden remains attached to this surface.",
    )!;
  }

  return supportingFactor(
    "contradiction_burden",
    0.3,
    "Contradiction burden is currently contained.",
  )!;
}

function freshnessBurdenFactor(value: number): ConfidenceFactor {
  if (value >= 0.5) {
    return limitingFactor(
      "freshness_burden",
      value,
      "Freshness burden is high because newer, failed, or unstable inputs remain in play.",
    )!;
  }

  if (value > 0.15) {
    return limitingFactor(
      "freshness_burden",
      value,
      "Freshness burden is moderate and should be monitored against new inputs.",
    )!;
  }

  return supportingFactor(
    "freshness_burden",
    0.25,
    "Freshness burden is limited right now.",
  )!;
}

function entityClarityFactor(value: number): ConfidenceFactor {
  if (value >= 0.72) {
    return supportingFactor(
      "entity_clarity",
      value,
      "Entity scope is clear and well anchored to the current research object.",
    )!;
  }

  if (value >= 0.42) {
    return supportingFactor(
      "entity_clarity",
      value,
      "Entity scope is reasonably clear, but some references still remain broad.",
    )!;
  }

  return limitingFactor(
    "entity_clarity",
    1 - value,
    "Entity scope remains broad or loosely resolved.",
  )!;
}

function datePrecisionFactor(value: number): ConfidenceFactor {
  if (value >= 0.75) {
    return supportingFactor(
      "date_precision",
      value,
      "Timing support is anchored by precise dated signals.",
    )!;
  }

  if (value >= 0.45) {
    return supportingFactor(
      "date_precision",
      value,
      "Timing support exists, but still mixes precise and fuzzy dating.",
    )!;
  }

  return limitingFactor(
    "date_precision",
    1 - value,
    "Timing support remains fuzzy, which limits confidence in chronology-sensitive interpretations.",
  )!;
}

function stalePostureFactor(value: number): ConfidenceFactor {
  if (value >= 0.5) {
    return limitingFactor(
      "stale_posture",
      value,
      "This surface currently carries a stale posture against newer knowledge inputs.",
    )!;
  }

  return supportingFactor(
    "stale_posture",
    0.2,
    "No explicit stale posture is currently limiting confidence.",
  )!;
}

function reviewPostureFactor(value: number): ConfidenceFactor | null {
  if (value >= 0.75) {
    return supportingFactor(
      "review_posture",
      value,
      "Operator review has reinforced the current posture.",
    );
  }

  if (value > 0.15) {
    return supportingFactor(
      "review_posture",
      value,
      "Some operator review signal is attached to this object.",
    );
  }

  return null;
}

function buildSummary(factors: ConfidenceFactor[]): string {
  if (factors.length === 0) {
    return "Confidence remains heuristic and no major drivers are currently attached.";
  }

  const supporting = factors
    .filter((factor) => factor.direction === "supporting")
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 2);
  const limiting = factors
    .filter((factor) => factor.direction === "limiting")
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 2);

  if (supporting.length > 0 && limiting.length > 0) {
    return `Confidence is supported by ${summarizeFactorLabels(supporting)}, but constrained by ${summarizeFactorLabels(limiting)}.`;
  }

  if (supporting.length > 0) {
    return `Confidence is primarily supported by ${summarizeFactorLabels(supporting)}.`;
  }

  return `Confidence is primarily constrained by ${summarizeFactorLabels(limiting)}.`;
}

export function buildConfidenceAssessment(
  input: ConfidenceAssessmentInput,
): ConfidenceAssessment {
  const contradictionBurden = clamp(input.contradictionBurden ?? 0);
  const freshnessBurden = clamp(input.freshnessBurden ?? 0);
  const entityClarity = clamp(input.entityClarity ?? 0);
  const datePrecision = clamp(input.datePrecision ?? 0);
  const stalePosture = clamp(input.stalePosture ?? 0);
  const reviewPosture = clamp(input.reviewPosture ?? 0);

  const baseScore = deriveConfidenceScore({
    supportDensity: clamp(input.supportDensity),
    sourceDiversityCount: input.sourceDiversityCount,
    contradictionBurden,
    freshnessBurden,
    precisionSupport: datePrecision,
  });
  const score = clamp(
    baseScore + entityClarity * 0.08 - stalePosture * 0.08 + reviewPosture * 0.05,
  );

  const factors = [
    supportDensityFactor(clamp(input.supportDensity)),
    sourceDiversityFactor(input.sourceDiversityCount),
    input.contradictionBurden !== undefined
      ? contradictionBurdenFactor(contradictionBurden)
      : null,
    input.freshnessBurden !== undefined ? freshnessBurdenFactor(freshnessBurden) : null,
    input.entityClarity !== undefined ? entityClarityFactor(entityClarity) : null,
    input.datePrecision !== undefined ? datePrecisionFactor(datePrecision) : null,
    input.stalePosture !== undefined ? stalePostureFactor(stalePosture) : null,
    input.reviewPosture !== undefined ? reviewPostureFactor(reviewPosture) : null,
  ].filter((factor): factor is ConfidenceFactor => Boolean(factor));

  return {
    score,
    label: confidenceLabelFromScore(score),
    factors,
    summary: buildSummary(factors),
  };
}

export function serializeConfidenceFactors(factors: ConfidenceFactor[]): string {
  return JSON.stringify(factors);
}

export function parseConfidenceFactors(value: string | null | undefined): ConfidenceFactor[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is ConfidenceFactor =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof entry.key === "string" &&
        typeof entry.label === "string" &&
        typeof entry.direction === "string" &&
        typeof entry.strength === "number" &&
        typeof entry.detail === "string",
    );
  } catch {
    return [];
  }
}
