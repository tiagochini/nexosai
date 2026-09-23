---
name: Preview readiness semantics
description: Rules for deciding whether persisted deliverables have an honest, renderable preview.
---

A persisted source is preview-ready only when it contains substantive, safely renderable content for that source. Non-null metadata, format, platform, configuration, title or status do not make a preview available. Serialized empty JSON such as `{}`, `[]`, `null` and recursively empty structures are also empty. Image and video representations require an actual safe persisted URL; never infer or invent one.

**Why:** Broad “any non-empty field” checks misclassified metadata-only records and serialized empty scripts as ready, producing misleading previews.

**How to apply:** For every new preview source, define its substantive fields explicitly, sanitize them first, and derive both readiness and representation from the sanitized payload.