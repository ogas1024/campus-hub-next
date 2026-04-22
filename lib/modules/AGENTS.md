# Module Services AGENTS

## Purpose

- `lib/modules/` contains service-layer and domain-layer code.
- This layer should orchestrate workflows, permissions, audit, and UX-friendly validation.

## Boundary rules

- Service-layer checks are important, but they should not be the only protection for critical database integrity rules in active modules.
- If a rule is central to consistency, ask:
  - should this also exist in the database?
  - if not, is there a clear reason?

## Current phase priority

- When editing active modules, prefer surfacing missing DB constraints rather than silently compensating forever in service code.
- Especially watch for:
  - overlap/conflict rules
  - denormalized field consistency
  - status-field coherence
  - duplicate-prevention semantics

## Audit and permissions

- Preserve audit-writing behavior for management actions.
- Keep permission logic explicit and understandable.
