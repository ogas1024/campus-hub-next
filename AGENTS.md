# Project AGENTS

## Current phase

- This repository is currently being used for the database course design of "校园生活平台".
- The active course-design source of truth is:
  - `docs/course-design/README.md`
  - `docs/course-design/teacher-db-checklist.md`
  - `docs/course-design/module-db-health-check.md`
  - `docs/course-design/what-else-matters.md`

## Current focus

- Platform core:
  - auth / profiles
  - organization
  - RBAC
  - data permission
  - audit log
- Core business:
  - facility reservation
  - course resources
- Optional extension:
  - library

Unless the user explicitly expands scope, treat other historical modules as non-primary for this phase.

## Default decision rule

- When "engineering convenience" conflicts with "database course design quality", prefer the database-course-friendly choice for the active modules.
- Default preferences for active modules:
  - explicit physical foreign keys
  - clear `ON DELETE` behavior
  - `CHECK` / `UNIQUE` / trigger-based integrity where appropriate
  - explicit normalization reasoning
  - database-enforced constraints over app-only rules

## Documentation policy

- Do not directly delete historical documents just to simplify the tree.
- Move out-of-scope materials to `docs/_archive/`.
- Keep `README.md` and `docs/README.md` aligned with the current course-design scope.

## Change policy

- If a database rule changes, update both:
  - implementation (`packages/db/**`, related services/routes)
  - course-design documentation (`docs/course-design/**`, `docs/report/**` where relevant)
- Avoid unrelated expansion of non-primary modules during this phase.

## Directory-specific guidance

- `docs/AGENTS.md`: documentation structure and archive rules
- `packages/db/AGENTS.md`: database-first design rules
- `lib/modules/AGENTS.md`: service-layer boundaries
- `app/api/AGENTS.md`: route-layer boundaries
