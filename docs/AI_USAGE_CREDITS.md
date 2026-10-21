# AI usage metering and NexOS credits

## Pricing rule

NexOS credits use a face value of US$0.01 per credit (`CREDITS_PER_USD = 100`).
AI usage is priced at three times the estimated provider cost by default:

`NexOS credits charged = ceil(provider cost in USD × 100 × 3)`

For example, US$0.10 of provider cost produces a 30-credit debit, equivalent to
US$0.30 in NexOS credit value. Fractional credit results round up to the next
whole credit.

The platform admin can change the multiplier in Admin → Custo IA. It is stored
in `ai_credit_settings`, applies to new provider calls, and does not rewrite
historical charges. The API caches this setting for up to 15 seconds. The
`CREDIT_MARGIN_MULTIPLIER` environment variable is the fallback if the setting
table is unavailable.

The provider, model, input/output tokens, latency, estimated provider cost, and
calculated credits are recorded in `ai_provider_logs`. The admin cost report
breaks usage down by campaign, agent, provider, and model. The corresponding
debit also records provider, token count, cost, and charged credits in the
credit ledger. Cost is estimated from the model price table; it is not an
invoice reconciliation with the provider.

## Settlement behavior

Campaign-agent runs, critique-loop runs, and direct chat/integration-chat
responses settle credits from measured token usage after a successful model
response. If a completed inference costs more credits than the workspace has,
the charge records the consumed usage and can make its balance negative; further
generation is blocked until the balance is replenished. This avoids delivering
completed paid inference without recording its provider cost.

Campaign processing has a hard preflight gate before strategy, content, and
launch phases. It requires the remaining balance to cover the expected average
campaign cost. Once at least three completed campaigns of the same type have
credit-debit history, the gate uses their average; before then it uses the
campaign type's configured typical estimate. Content and launch phases also
retain minimum estimates of 150 and 37 credits. The check returns HTTP 402 with
the balance, required credits, estimated total, and estimate source when blocked.

Some standalone/legacy operations still use fixed `CREDIT_COSTS` tariffs rather
than settling from provider usage. Those flows are not yet guaranteed to follow
the 3× rule and must be migrated before claiming exact usage-based parity across
every AI feature.

## Deployment

Apply migration `0070_ai_credit_settings.sql` in each environment before using
the admin control. Keep `CREDIT_MARGIN_MULTIPLIER=3` as a safe fallback, then
verify the effective value and compare `ai_provider_logs` with the credit
ledger after a metered generation in homologation.

Meta, WhatsApp, payment, and other external integration API calls are not AI
token usage and are not included in this AI cost report. Their provider-side
fees and per-call metering require separate instrumentation and provider billing
data where applicable.
