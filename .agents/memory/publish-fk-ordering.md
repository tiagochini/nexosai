---
name: Publish foreign-key ordering
description: How to safely publish a new composite tenant foreign key when its parent unique constraint is also new.
---

When a schema change introduces both a parent composite unique constraint and
new foreign keys that reference it, publish them in two stages. First publish
the parent unique constraint while the new child tables reference an already
existing globally unique primary key. After that publish succeeds, restore the
composite tenant foreign keys and publish again.

**Why:** Replit's development-to-production schema diff can emit foreign-key
statements before the new unique constraint they require. PostgreSQL then
rejects the first foreign key with “there is no unique constraint matching
given keys,” even though the unique constraint appears later in the same diff.

**How to apply:** Never copy or truncate production to bypass this ordering
failure. Keep application queries tenant-scoped during the brief first stage,
verify the first publish created the parent composite unique constraint, then
restore and publish the composite foreign keys as the second stage.