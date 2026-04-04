export type NavigationItem = {
  href: string;
  label: string;
  description: string;
  shortLabel: string;
};

export const workspaceNavigation: NavigationItem[] = [
  {
    href: "/projects",
    label: "Projects",
    description: "Research command, loaded project, and portfolio state.",
    shortLabel: "PJ",
  },
  {
    href: "/sources",
    label: "Sources",
    description: "Raw inputs and provenance for the active project workspace.",
    shortLabel: "SO",
  },
  {
    href: "/wiki",
    label: "Wiki",
    description: "Canonical pages and revisions for the active project.",
    shortLabel: "WK",
  },
  {
    href: "/lint",
    label: "Lint",
    description: "Knowledge health issues and trust gaps in the active canon.",
    shortLabel: "LT",
  },
  {
    href: "/artifacts",
    label: "Artifacts",
    description: "Durable outputs generated inside the active project.",
    shortLabel: "AR",
  },
  {
    href: "/thesis",
    label: "Thesis",
    description: "Compiled investment thesis view for the active project workspace.",
    shortLabel: "TH",
  },
  {
    href: "/dossier",
    label: "Dossier",
    description: "Structured company dossier compiled from canon, claims, sources, and research outputs.",
    shortLabel: "DS",
  },
  {
    href: "/catalysts",
    label: "Catalysts",
    description: "First-class catalyst tracker linking thesis, timeline, contradictions, and evidence.",
    shortLabel: "CT",
  },
  {
    href: "/timeline",
    label: "Timeline",
    description: "Compiled chronology of the active project knowledge base.",
    shortLabel: "TL",
  },
  {
    href: "/monitoring",
    label: "Monitoring",
    description: "Freshness intelligence and stale-alert operations for compiled research views.",
    shortLabel: "MN",
  },
  {
    href: "/contradictions",
    label: "Contradictions",
    description: "Compiled disagreement map across canon, sources, claims, and chronology.",
    shortLabel: "CD",
  },
  {
    href: "/ask",
    label: "Ask",
    description: "Project-scoped research queries resolved against canon first.",
    shortLabel: "AK",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Policies for compilation, provenance, and provider boundaries.",
    shortLabel: "ST",
  },
];
