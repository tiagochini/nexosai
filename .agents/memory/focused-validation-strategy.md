---
name: Focused Validation Strategy
description: Project-approved testing approach that reduces waste while preserving production confidence.
---

Use a layered validation model: run cheap contract/type/build checks first, exercise isolated fixtures for the risky boundary, and re-test only the branches affected by each correction. Run one decisive end-to-end pass after targeted checks are green.

**Why:** The user explicitly confirmed this model is faster, more precise, and avoids token and execution waste. Repeating already-passing journeys obscures the real blocker and increases cost without improving confidence.

**How to apply:** Keep fixtures strictly namespaced and always clean them up; use fail-once injection for retry paths; preserve the same tester context across focused reruns; require a final success verdict before recommending production.