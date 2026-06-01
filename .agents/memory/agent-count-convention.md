---
name: Agent Count Convention
description: Canonical agent counts and benchmark dates used consistently across all NexOS artifacts.
---

## Rule

There are TWO distinct agent counts used in different contexts — never mix them:

### 64 — Total Agent Count
Used in: sidebar badge, i18n.tsx, backend prompt copy, checkout page, dashboard, direct-chat prompts, nexos-self-launch, sales-team prompts.
This is the full hub of agents (all categories combined in agents/index.tsx).

### 35 — Landing Page Core Agents
Used in: landing.tsx (plan items, sorteio section, pitch copy), landing-demo-sections.tsx captions, hub.tsx description.
This is the subset listed on the landing page (7+10+3+4+3+3+5 = 35).

## Benchmark Dates

All benchmark references should use **Q1 2026** (not Q1 2025):
- `landing-demo-sections.tsx` — "Benchmarks Q1 2026"
- `intake.simulation.ts` — "Q1 2026"
- `budget-simulator.tsx` — "Q1 2026"

**Why:** Platform launched in 2026; Q1 2025 data is stale and undermines credibility.

## How to Apply

When adding new copy that mentions agent counts:
- Backend prompts, UI stat displays, checkout → use **64**
- Landing page feature lists, pitch copy → use **35**
- Never use 34, 57, or 63 (old stale counts)
