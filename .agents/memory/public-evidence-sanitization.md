---
name: Public evidence sanitization
description: Safety rules for exposing provider and execution evidence in customer-facing APIs.
---

Customer-facing evidence APIs must recursively redact complete secret values before performing string truncation, strip credentials and query/fragment data from URLs, and enforce hard depth, node and collection limits by stopping traversal rather than continuing with per-item placeholders.

**Why:** Truncating first can break PEM/JWT patterns and leak their prefixes, while iterating after a nominal node limit still permits CPU and response amplification from very wide persisted evidence.

**How to apply:** Sanitize on the server before serialization. Fail closed for secret-like values even under innocuous keys, preserve only non-secret evidence, emit one bounded truncation marker per limited collection, and test long secrets plus adversarially wide nested structures.