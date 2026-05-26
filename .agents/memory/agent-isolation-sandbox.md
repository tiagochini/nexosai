---
name: Agent Isolation Sandbox
description: runIsolatedAgent() wraps runAgent() with typed result union and never throws — safe for pipeline use
---

## Rule
For pipeline-critical agent calls, prefer `runIsolatedAgent()` over calling `runAgent()` directly.

```typescript
import { runIsolatedAgent } from "../agents/agent-isolation-sandbox.js";

const result = await runIsolatedAgent<MyOutput>(
  { ...agentInput, contract: { requiredOutputFields: ["field1"] } },
  fallbackValue,
);

if (!result.ok) { /* handle gracefully */ }
// result.data is typed and guaranteed to have requiredOutputFields
```

**Why:** `runAgent()` can throw, causing pipeline workers to crash. The sandbox returns `{ ok, data }` | `{ ok: false, error, errorCode }` union — pipeline never crashes from an agent failure.

**How to apply:** Use for any new agent integration in orchestration workers or scheduled jobs. Chat-direct agents can call runAgent() directly.
