# DB Schema AGENTS

## Purpose

- Files here define the Drizzle-side schema representation.
- They should stay conceptually aligned with SQL migrations.

## Rules

- Prefer explicit references for real relationships.
- Do not model core relational links as plain UUID/text fields just for convenience if the SQL migration uses real FKs.
- Keep indexes and enums visible when they matter to understanding the data model.

## Current emphasis

- Make the schema easy to read as a relational model.
- For active modules, optimize for:
  - clarity of entity relationships
  - explainable keys
  - explicit status / type enums
  - close correspondence with course-design docs

## If a mismatch appears

- If schema and migration diverge, treat that as something to resolve, not something to ignore.
