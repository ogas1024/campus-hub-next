# DB Migrations AGENTS

## Purpose

- Migrations in this directory are the authoritative SQL history for the current project state.

## Rules

- Keep migrations forward-only unless the user explicitly asks for a different strategy.
- Preserve numbered ordering.
- Write SQL that is readable in Supabase SQL Editor.
- Add short comments for important design choices, especially when they matter for course-design explanation.

## Current phase preferences

- For active modules, prefer database-visible constraints over app-only guarantees.
- Good candidates include:
  - explicit foreign keys
  - `CHECK` constraints
  - partial / composite indexes
  - trigger-based consistency
  - PostgreSQL-native integrity features when they improve course-design quality

## Safety rules

- Do not drop or weaken constraints casually.
- Avoid destructive cleanup of historical structures unless the user explicitly asks for it.
- When changing a rule, think about:
  - existing data compatibility
  - documentation updates
  - whether the new design is easier to defend academically
