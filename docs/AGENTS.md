# Docs AGENTS

## Purpose

- `docs/` exists to support the current database course design phase.
- The main entry is `docs/course-design/README.md`.

## Structure rules

- `course-design/`: current phase navigation, checklists, report planning
- `requirements/`: active requirement docs only
- `api/`: active API contract docs only
- `report/`: active report materials only
- `ops/`: operational and verification notes
- `_archive/`: historical or out-of-scope documents

## Archive-first policy

- If a document is no longer part of the current mainline, archive it.
- Do not silently delete historical docs if they may still provide context.
- Keep archive batches grouped and explained with a local `README.md`.

## Current scope

- Primary:
  - platform core
  - facility reservation
  - course resources
- Optional:
  - library
- Historical modules should not be re-exposed in the main docs entry unless the user explicitly brings them back.

## Writing rules

- Prefer Chinese.
- Keep docs practical and searchable.
- Make current-phase source-of-truth files easy to find from `docs/README.md`.
