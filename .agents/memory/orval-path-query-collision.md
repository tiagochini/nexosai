---
name: Orval path/query name collision
description: Why some OpenAPI operations need deterministic postprocessing in the generated Zod package.
---

Orval 8.5 can emit the same exported name twice in the API Zod barrel when one operation combines a path parameter with query parameters: the path validator and generated query type both use the operation-derived `*Params` name.

**Why:** The generated code is otherwise valid, but the wildcard barrel exports fail with TS2308 after codegen. Hand-editing generated output is not durable because the next codegen removes the fix.

**How to apply:** Preserve a deterministic post-codegen rename for the colliding Zod-side query type, run it before library typecheck, and keep application imports on generated contracts rather than duplicating response types.