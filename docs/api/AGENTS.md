# API Docs AGENTS

## Purpose

- API docs here describe active BFF contracts for the current course-design mainline.

## Rules

- Keep only active-module API docs in the main tree.
- For current phase, prioritize:
  - platform core related APIs
  - facility reservation APIs
  - course resources APIs
  - optional library APIs

## Documentation focus

- Include:
  - route
  - method
  - permission
  - request / response
  - important state transitions
- Do not let API docs become the only place where a critical rule exists.
- If a rule should really be database-enforced, reflect that in DB docs and implementation too.
