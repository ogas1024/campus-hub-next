# API Routes AGENTS

## Purpose

- `app/api/` is the BFF route layer.
- Routes should stay thin and delegate business logic to `lib/modules/**`.

## Rules

- Do not put direct database-heavy business logic in route handlers unless there is a very good reason.
- Do not make route handlers the only place where a critical rule exists.
- Route handlers should reflect:
  - authentication
  - permission checks
  - request parsing / response formatting
  - delegation to service-layer workflows

## Current phase reminder

- For active modules, API correctness is important, but database design quality is the main priority.
- If a route currently compensates for a missing DB constraint, note that in service/schema/migration work rather than treating the route as the final solution.
