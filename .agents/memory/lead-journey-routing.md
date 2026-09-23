---
name: Lead journey routing
description: Rules for segment-aware, stage-aware communications and sales-agent progression.
---

Every lead follows an individual route. Score classification (`cold`, `warm`, `hot`) and journey stage are separate dimensions, and both must authorize a communication before email or WhatsApp can send it. Warm leads never receive cart or closing messages; closing requires a hot lead in the closing stage.

**Why:** The user explicitly confirmed that communication must match each lead's classification and completed phases. Previously, all segments could receive the hot variant and intermediate leads could receive closing content.

**How to apply:** Use one canonical segment × stage × phase matrix in both application logic and SQL. Require the exact segment copy with no hot/default fallback. Journey advancement is adjacent-only, tenant-scoped, CAS-fenced, and requires non-empty evidence. Individual sales agents guide conversations but cannot skip stages, invent offers, or bypass the routing policy.