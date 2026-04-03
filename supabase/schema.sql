-- EregionForge initial schema blueprint

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  description text,
  domain text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  source_type text not null,
  title text,
  body text,
  url text,
  file_path text,
  status text not null default 'pending',
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_fragments (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  ordinal integer,
  content text not null,
  fragment_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists wiki_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  slug text not null,
  title text not null,
  page_type text not null,
  current_revision_id uuid,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, slug)
);

create table if not exists wiki_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references wiki_pages(id) on delete cascade,
  markdown_content text not null,
  summary text,
  change_note text,
  confidence text,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  page_id uuid references wiki_pages(id) on delete set null,
  claim_text text not null,
  status text not null default 'supported',
  confidence text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists evidence_links (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  source_fragment_id uuid references source_fragments(id) on delete set null,
  support_level text not null default 'supported',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  artifact_type text not null,
  title text not null,
  markdown_content text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists compile_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ask_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  query text not null,
  answer_markdown text,
  confidence text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lint_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  issue_type text not null,
  severity text not null,
  status text not null default 'open',
  target_type text,
  target_id uuid,
  title text not null,
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
