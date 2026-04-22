# Course Design Docs AGENTS

## Role of this directory

- This directory is the primary source of truth for the current database course design phase.
- If a future conversation starts anywhere in the repo, these files should quickly explain:
  - what the active scope is
  - how the teacher is likely to judge the design
  - which modules need database-first improvement

## Must-keep files

- `README.md`: entry and navigation
- `scope.md`: current scope boundary
- `report-outline.md`: report structure
- `teacher-db-checklist.md`: teacher-view checklist
- `module-db-health-check.md`: current module diagnosis
- `what-else-matters.md`: missing but important concerns

## Update rules

- If scope changes, update `scope.md` first.
- If evaluation priorities change, update `teacher-db-checklist.md`.
- If the database design of an active module changes materially, update `module-db-health-check.md`.

## Style

- Optimize for fast onboarding in a new conversation.
- Prefer explicit statements over implicit assumptions.
- Write from a database-course perspective, not a generic web-engineering perspective.
