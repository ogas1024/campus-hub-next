# Report Docs AGENTS

## Purpose

- Files here support the final course-design report and defense.
- These documents should emphasize database design, not frontend polish.

## Structure

- `overview/`: global database design materials
- `modules/`: module-level report materials
- `database/`: physical design, SQL/transactions, validation/tests
- `manuscript/`: final submission-ready report body
- `README.md`: report navigation and writing entry

## Writing priorities

- Explain:
  - entities and relationships
  - relation schemas
  - keys and foreign keys
  - integrity constraints
  - normalization / necessary redundancy
  - transactions and concurrency
  - indexes and physical design
- Keep UI discussion minimal unless it helps explain a database workflow.

## Module priority

- Highest priority:
  - `modules/platform-core.md`
  - `modules/facility-reservation.md`
  - `modules/course-resources.md`
- Secondary:
  - `modules/library.md`

## Consistency rule

- Report claims should match real migrations and code.
- Do not describe a database constraint as "done" unless it exists in schema/migration or is explicitly marked as planned.
