import type { RevisionConfidence } from "@/lib/domain/types";

export type SemanticTheme =
  | "pricing"
  | "demand"
  | "margin"
  | "timing"
  | "earnings"
  | "product"
  | "regulatory"
  | "customer"
  | "macro"
  | "supply"
  | "guidance"
  | "competition"
  | "execution";

type ThemeSignalProfile = {
  positive: number;
  negative: number;
  net: number;
};

export type SemanticProfile = {
  normalized: string;
  themes: SemanticTheme[];
  positiveSignals: number;
  negativeSignals: number;
  themeSignals: Partial<Record<SemanticTheme, ThemeSignalProfile>>;
};

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "page",
  "source",
  "sources",
  "claim",
  "claims",
  "project",
  "current",
  "should",
  "would",
  "could",
  "their",
  "there",
  "about",
  "after",
  "before",
]);

const themeMatchers: Record<SemanticTheme, string[]> = {
  pricing: ["pricing", "price", "asp", "discount", "premium", "list price"],
  demand: ["demand", "orders", "order", "backlog", "consumption", "bookings", "volume"],
  margin: ["margin", "gross margin", "ebitda", "profitability", "returns", "mix"],
  timing: ["timing", "timeline", "schedule", "window", "delay", "accelerate", "slip", "pushout"],
  earnings: ["earnings", "results", "quarter", "q1", "q2", "q3", "q4", "fy202", "investor day"],
  product: ["launch", "ramp", "rollout", "product", "platform", "module", "release", "qualification"],
  regulatory: ["regulatory", "approval", "permit", "compliance", "regulator", "certification"],
  customer: ["customer", "contract", "design win", "design-in", "program win", "award", "qualification"],
  macro: ["macro", "industry", "cyclical", "market", "sector", "end market"],
  supply: ["supply", "capacity", "inventory", "utilization", "fab", "lead time", "allocation"],
  guidance: ["guidance", "outlook", "forecast", "guide", "revision", "revised"],
  competition: ["competition", "competitor", "share", "displacement", "alternative"],
  execution: ["execution", "on track", "operational", "deliver", "implementation", "milestone"],
};

const globalPositiveSignals = [
  "improve",
  "improved",
  "improvement",
  "higher",
  "above",
  "accelerate",
  "durable",
  "stable",
  "strong",
  "upside",
  "expansion",
  "expand",
  "premium",
  "ramp",
  "win",
  "ahead",
  "beat",
];

const globalNegativeSignals = [
  "pressure",
  "compress",
  "compression",
  "lower",
  "below",
  "weaker",
  "soft",
  "risk",
  "downside",
  "delay",
  "slower",
  "slip",
  "pushout",
  "miss",
  "cut",
  "uncertain",
  "invalidated",
  "stale",
];

const themePositiveSignals: Partial<Record<SemanticTheme, string[]>> = {
  pricing: ["price increase", "pricing holds", "premium", "stable pricing", "higher asp"],
  demand: ["strong demand", "backlog build", "bookings improve", "volume recovery"],
  margin: ["margin expansion", "improved margin", "profitability improvement"],
  timing: ["ahead of schedule", "on track", "accelerate", "pull forward"],
  earnings: ["beat", "upside", "raise", "higher earnings"],
  product: ["launch on track", "ramp", "qualification", "production start"],
  regulatory: ["approval", "clearance", "permit secured"],
  customer: ["design win", "new contract", "customer award"],
  macro: ["market recovery", "industry improvement"],
  supply: ["capacity unlock", "inventory normalization", "utilization improvement"],
  guidance: ["raise guidance", "guidance improved", "outlook strengthens"],
  competition: ["share gain", "displacement win", "competitive advantage"],
  execution: ["executing well", "on track", "delivered"],
};

const themeNegativeSignals: Partial<Record<SemanticTheme, string[]>> = {
  pricing: ["price cut", "pricing pressure", "discounting", "asp compression"],
  demand: ["demand softens", "order slowdown", "backlog burn", "weaker demand"],
  margin: ["margin pressure", "margin compression", "profitability weakens"],
  timing: ["delay", "slip", "pushout", "later than expected"],
  earnings: ["miss", "earnings pressure", "weaker quarter"],
  product: ["launch delay", "ramp slips", "qualification delay"],
  regulatory: ["regulatory delay", "compliance risk", "approval uncertainty"],
  customer: ["customer loss", "contract risk", "design-out"],
  macro: ["industry slowdown", "cyclical pressure", "macro headwind"],
  supply: ["capacity constraint", "inventory overhang", "utilization pressure"],
  guidance: ["cut guidance", "guidance lowered", "outlook weakens"],
  competition: ["share loss", "competitive pressure"],
  execution: ["execution risk", "missed milestone", "operational issue"],
};

export function normalizeSemanticText(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim()} `;
}

function countMatches(normalized: string, phrases: string[]): number {
  return phrases.reduce((count, phrase) => {
    const needle = ` ${phrase.toLowerCase()} `;
    return count + (normalized.includes(needle) ? 1 : 0);
  }, 0);
}

export function tokenizeMeaningful(value: string): Set<string> {
  return new Set(
    normalizeSemanticText(value)
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

export function sharedMeaningfulTokens(left: Set<string>, right: Set<string>): string[] {
  return Array.from(left).filter((token) => right.has(token)).slice(0, 6);
}

export function detectSemanticThemes(value: string): SemanticTheme[] {
  const normalized = normalizeSemanticText(value);

  return (Object.keys(themeMatchers) as SemanticTheme[]).filter((theme) =>
    themeMatchers[theme].some((matcher) =>
      normalized.includes(` ${matcher.toLowerCase()} `),
    ),
  );
}

export function buildSemanticProfile(value: string): SemanticProfile {
  const normalized = normalizeSemanticText(value);
  const themes = detectSemanticThemes(value);
  const themeSignals = Object.fromEntries(
    themes.map((theme) => {
      const positive =
        countMatches(normalized, themePositiveSignals[theme] ?? []) +
        countMatches(normalized, globalPositiveSignals);
      const negative =
        countMatches(normalized, themeNegativeSignals[theme] ?? []) +
        countMatches(normalized, globalNegativeSignals);

      return [
        theme,
        {
          positive,
          negative,
          net: positive - negative,
        },
      ] as const;
    }),
  ) as Partial<Record<SemanticTheme, ThemeSignalProfile>>;

  return {
    normalized,
    themes,
    positiveSignals: countMatches(normalized, globalPositiveSignals),
    negativeSignals: countMatches(normalized, globalNegativeSignals),
    themeSignals,
  };
}

export function sharedThemes(left: SemanticProfile, right: SemanticProfile): SemanticTheme[] {
  return left.themes.filter((theme) => right.themes.includes(theme));
}

export function dominantConflictTheme(
  left: SemanticProfile,
  right: SemanticProfile,
): SemanticTheme | null {
  const shared = sharedThemes(left, right);
  let bestTheme: SemanticTheme | null = null;
  let bestScore = 0;

  for (const theme of shared) {
    const leftSignal = left.themeSignals[theme];
    const rightSignal = right.themeSignals[theme];

    if (!leftSignal || !rightSignal) {
      continue;
    }

    if (
      (leftSignal.net > 0 && rightSignal.net < 0) ||
      (leftSignal.net < 0 && rightSignal.net > 0)
    ) {
      const score = Math.abs(leftSignal.net) + Math.abs(rightSignal.net);
      if (score > bestScore) {
        bestScore = score;
        bestTheme = theme;
      }
    }
  }

  return bestTheme;
}

export function formatThemeLabel(theme: SemanticTheme): string {
  switch (theme) {
    case "pricing":
      return "pricing";
    case "demand":
      return "demand";
    case "margin":
      return "margin";
    case "timing":
      return "timing";
    case "earnings":
      return "earnings";
    case "product":
      return "product ramp";
    case "regulatory":
      return "regulatory";
    case "customer":
      return "customer or contract";
    case "macro":
      return "macro";
    case "supply":
      return "supply";
    case "guidance":
      return "guidance";
    case "competition":
      return "competition";
    case "execution":
      return "execution";
  }
}

export function summarizeThemeList(themes: SemanticTheme[]): string {
  if (themes.length === 0) {
    return "general thesis posture";
  }

  return themes.slice(0, 3).map((theme) => formatThemeLabel(theme)).join(", ");
}

export function deriveConfidenceScore(input: {
  supportDensity: number;
  sourceDiversityCount: number;
  contradictionBurden: number;
  freshnessBurden: number;
  precisionSupport: number;
}): number {
  const diversityScore = Math.min(input.sourceDiversityCount / 4, 1);
  const supportScore = Math.max(0, Math.min(input.supportDensity, 1));
  const contradictionPenalty = Math.max(0, Math.min(input.contradictionBurden, 1));
  const freshnessPenalty = Math.max(0, Math.min(input.freshnessBurden, 1));
  const precisionScore = Math.max(0, Math.min(input.precisionSupport, 1));

  const score =
    supportScore * 0.4 +
    diversityScore * 0.2 +
    precisionScore * 0.18 -
    contradictionPenalty * 0.14 -
    freshnessPenalty * 0.08;

  return Math.max(0, Math.min(score, 1));
}

export function confidenceLabelFromScore(score: number): RevisionConfidence {
  if (score >= 0.62) {
    return "high";
  }

  if (score >= 0.34) {
    return "medium";
  }

  return "low";
}

export function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}
