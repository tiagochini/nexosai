---
name: Publish CHECK validation
description: Why unvalidated development CHECK constraints can produce invalid SQL for tables that are new in production.
---

Before publishing a table that does not yet exist in production, ensure its development `CHECK` constraints have `convalidated = true`. A validated constraint can be emitted inline in `CREATE TABLE`; an unvalidated one may be rendered inline with `NOT VALID`, which PostgreSQL rejects.

**Why:** `NOT VALID` is legal for `ALTER TABLE ... ADD CONSTRAINT ... CHECK ... NOT VALID`, but not for a table constraint inside `CREATE TABLE`. A development migration that deliberately left checks unvalidated caused the publish diff to preserve an impossible syntax.

**How to apply:** Query `pg_constraint.convalidated`, verify zero violating rows, run `VALIDATE CONSTRAINT` only in development, and recompute the development-to-production diff. Also inspect equivalent FKs for duplicates introduced by both inline and explicit migration declarations.