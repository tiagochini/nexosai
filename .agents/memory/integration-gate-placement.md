---
name: Integration Gate Placement
description: Integration check belongs ONLY at execute/launch — never at content approval or status PATCH.
---

## Rule

`checkIntegrationsForLaunch()` lives in `execution.routes.ts`, triggered only by `POST /campaigns/:id/execute/launch`.

**Never add the integration gate to:**
- `PATCH /campaigns/:id/status` (approval transition)
- Content approval endpoints
- Any phase before launch

## Why

User principle: "posso aprovar todo conteudo mas nao posso lançar sem as integrações." Content delivery is non-negotiable. Integrations are a launch authorization concern, not a content concern. Adding the gate to the approval transition blocked users from reviewing and approving content even when integrations weren't connected yet — a fundamental UX regression.

## How to apply

If asked to "add integration check before launch" — confirm the trigger is `execute/launch` only. If asked to "block approval without integrations" — refuse; direct to the launch gate instead.
