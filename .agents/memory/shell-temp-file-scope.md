---
name: Shell temporary-file scope
description: Workspace nuance for artifacts created across separate shell executions.
---

Files written under `/tmp` may not survive between separate shell executions, even when managed log files remain available.

**Why:** A database restore's cleaned SQL was generated in one shell execution and was missing in the next; the transaction aborted before applying it, leaving the existing database unchanged.

**How to apply:** For multi-step operations that pass files between shell executions, use a verified Git-ignored workspace directory, remove sensitive intermediates after validation, and retain only a clearly named recovery snapshot when rollback risk justifies it.