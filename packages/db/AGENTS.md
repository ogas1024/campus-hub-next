# Database AGENTS

## Role of this directory

- `packages/db/` is the core of the current course-design phase.
- Changes here should favor database-design quality and explainability, not only engineering convenience.

## Default database principles

- Prefer explicit physical foreign keys for core relationships.
- Prefer clear `ON DELETE` strategies with business justification.
- Prefer database-enforced integrity for important active-module rules:
  - `PRIMARY KEY`
  - `FOREIGN KEY`
  - `UNIQUE`
  - `CHECK`
  - triggers / database functions where needed
- For active modules, default toward teacher-friendly design choices unless the user explicitly asks otherwise.

## Normalization rule

- Aim for 3NF for core transactional tables.
- If keeping denormalized fields:
  - document why they exist
  - document how consistency is guaranteed
  - prefer a DB-level consistency mechanism when reasonable

## Sync rule

- Keep `src/schema/**` and `migrations/**` aligned.
- If a migration adds a real FK, check/index/enum/trigger, the schema layer should not hide that relationship as a loose raw ID without reason.

## Current priority modules

- platform core
- facility reservation
- course resources
- optional library extension
