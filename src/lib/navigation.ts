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
    description: "Project boundaries, execution order, and portfolio state.",
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
