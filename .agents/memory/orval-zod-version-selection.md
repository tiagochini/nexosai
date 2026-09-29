---
name: Orval Zod version selection
description: Prevent code generation from selecting a validator API incompatible with the app's runtime version.
---

When regenerating API contracts, explicitly select the output Zod major that the generated package actually uses; do not trust the generator's automatic peer-version detection.

**Why:** The generator can resolve its own Zod 4 peer while the application still runs Zod 3. The resulting validators call APIs unavailable at runtime. A generator-version change can also alter client helpers and integer constraints, so a large generated diff is not necessarily formatting-only.

**How to apply:** After changing the API spec or generator, verify the generated validators against the runtime Zod major, typecheck the shared libraries, and smoke-check a representative client query and server validation path. Generated header iteration may also require DOM iterable typings in the client library.