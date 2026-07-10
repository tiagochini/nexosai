---
name: AI generation providers are platform infra, not customer integrations
description: HeyGen/ElevenLabs/Runway/Kling (and any AI generation provider) must never accept a customer-supplied API key — check this before adding "connect your own account" UI for any AI capability.
---

Providers that perform AI generation work on behalf of the product (avatar video, voice cloning, video generation, LLM calls, etc.) must always use the platform's own credentials, never a customer-supplied key.

**Why:** the product's revenue model is built on metering AI usage via an internal credit system. If a customer can plug in their own API key for an AI provider, they generate for free and bypass the credit/consumption model entirely — this guts the recurring-revenue mechanism, even though it looks like a normal "integration" feature.

**How to apply:** only social networks, messaging apps, email/CRM tools, and payment gateways are legitimate customer-connectable integrations. Before adding a "connect your account" flow for any provider, ask: does using this provider consume AI compute/generation the platform pays for? If yes, it must use a platform-level env var/secret exclusively, with no per-workspace key override or storage path.
