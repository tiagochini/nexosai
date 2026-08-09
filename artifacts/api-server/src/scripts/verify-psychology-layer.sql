-- ============================================================
-- Psychology Layer Verification Queries — Task #97
-- ============================================================
-- Run against the NexOS Postgres DB to confirm the 7 offer
-- psychology agents executed in the correct order and that
-- their output was injected into copy agents.
--
-- Substitute <CAMPAIGN_ID> with a real campaign UUID before running.
-- ============================================================

-- ── 1. Confirm all 6 psychology agents executed for a campaign ──────────────
-- Expected statuses: 'completed' for all
-- Expected agent_type values: pricing_psychologist, upsell_architect,
-- objection_killer, testimonial_curator, scarcity_engineer, hook_factory

SELECT
  ca.agent_type          AS agent_role,
  ca.status,
  ca.started_at,
  ca.completed_at,
  EXTRACT(EPOCH FROM (ca.completed_at - ca.started_at))::int AS duration_sec
FROM campaign_agents ca
WHERE
  ca.campaign_id = '<CAMPAIGN_ID>'
  AND ca.agent_type IN (
    'pricing_psychologist', 'upsell_architect',
    'objection_killer',     'testimonial_curator',
    'scarcity_engineer',    'hook_factory'
  )
ORDER BY ca.started_at;

-- ── 2. Confirm A→B→C execution order (parallel groups, then sequential) ────
-- Step A (pricing_psychologist + upsell_architect) started_at should be roughly equal
-- Step B (objection_killer + testimonial_curator + scarcity_engineer) started_at
--   should be AFTER the MAX(completed_at) of Step A
-- Step C (hook_factory) started_at should be AFTER MAX(completed_at) of Step B

WITH agent_timing AS (
  SELECT
    agent_type,
    started_at,
    completed_at,
    CASE
      WHEN agent_type IN ('pricing_psychologist','upsell_architect') THEN 'A'
      WHEN agent_type IN ('objection_killer','testimonial_curator','scarcity_engineer') THEN 'B'
      WHEN agent_type = 'hook_factory' THEN 'C'
    END AS step
  FROM campaign_agents
  WHERE campaign_id = '<CAMPAIGN_ID>'
    AND agent_type IN (
      'pricing_psychologist', 'upsell_architect',
      'objection_killer',     'testimonial_curator',
      'scarcity_engineer',    'hook_factory'
    )
)
SELECT
  step,
  MIN(started_at)    AS step_started,
  MAX(completed_at)  AS step_completed,
  EXTRACT(EPOCH FROM (MAX(completed_at) - MIN(started_at)))::int AS step_duration_sec,
  array_agg(agent_type ORDER BY started_at) AS agents_in_step
FROM agent_timing
GROUP BY step
ORDER BY step;

-- ── 3. Confirm psychology layer was persisted to brainData ──────────────────
SELECT
  id,
  type,
  (brain_data -> 'offerPsychologyLayer') IS NOT NULL AS has_psych_layer,
  (brain_data -> 'offerPsychologyLayer' -> 'pricing')     IS NOT NULL AS has_pricing,
  (brain_data -> 'offerPsychologyLayer' -> 'upsell')      IS NOT NULL AS has_upsell,
  (brain_data -> 'offerPsychologyLayer' -> 'objections')  IS NOT NULL AS has_objections,
  (brain_data -> 'offerPsychologyLayer' -> 'testimonials') IS NOT NULL AS has_testimonials,
  (brain_data -> 'offerPsychologyLayer' -> 'scarcity')    IS NOT NULL AS has_scarcity,
  (brain_data -> 'offerPsychologyLayer' -> 'hooks')       IS NOT NULL AS has_hooks,
  brain_data -> 'offerPsychologyLayer' -> 'generatedAt'   AS generated_at
FROM campaigns
WHERE id = '<CAMPAIGN_ID>';

-- ── 4. Confirm copy agents received _psychologyLayer via audit log ───────────
-- agent_execution_logs.input_summary is populated by buildInputSummary() in agent.runner.ts.
-- The "[PSYCH-LAYER] injected" log line in content.service.ts also confirms injection.
-- Check that ad_copy / vsl_script / landing_page ran AFTER psychology layer was ready.

SELECT
  ael.agent_name,
  ael.execution_status,
  ael.started_at,
  ael.output_summary
FROM agent_execution_logs ael
WHERE
  ael.campaign_id = '<CAMPAIGN_ID>'
  AND ael.agent_name IN ('ad_copy', 'vsl_script', 'landing_page')
ORDER BY ael.started_at;

-- Cross-check: psychology agents completed before copy agents started
SELECT
  MAX(ca_psych.completed_at)                                        AS psych_layer_ready_at,
  MIN(ca_copy.started_at)                                           AS copy_agents_started_at,
  EXTRACT(EPOCH FROM (
    MIN(ca_copy.started_at) - MAX(ca_psych.completed_at)
  ))::int                                                           AS gap_sec
FROM campaign_agents ca_psych
CROSS JOIN campaign_agents ca_copy
WHERE ca_psych.campaign_id = '<CAMPAIGN_ID>'
  AND ca_copy.campaign_id  = '<CAMPAIGN_ID>'
  AND ca_psych.agent_type IN (
    'pricing_psychologist','upsell_architect',
    'objection_killer','testimonial_curator',
    'scarcity_engineer','hook_factory'
  )
  AND ca_copy.agent_type IN ('ad_copy','vsl_script','landing_page');
-- ✅ Pass: gap_sec >= 0 (copy started after psych layer was ready)

-- ── 5. Confirm zero credit duplication (idempotency_key = campaignId:agentRole) ──
-- Each psychology agent should have exactly ONE credit_transactions row per run.
-- Idempotency key format: "${campaignId}:${agentRole}"

SELECT
  idempotency_key,
  COUNT(*)       AS charge_count,
  SUM(amount)    AS total_credits,
  MIN(amount)    AS credit_amount,
  ai_provider,
  MIN(created_at) AS first_charge
FROM credit_transactions
WHERE
  campaign_id = '<CAMPAIGN_ID>'
  AND idempotency_key LIKE '<CAMPAIGN_ID>:%'
  AND idempotency_key ~ '(pricing_psychologist|upsell_architect|objection_killer|testimonial_curator|scarcity_engineer|hook_factory|semente_launch)$'
GROUP BY idempotency_key, ai_provider
ORDER BY idempotency_key;
-- ✅ Pass: charge_count = 1 for every row (idempotency guard prevented double-charge)
-- ❌ Fail: charge_count > 1 for any row

-- ── 6. Full psychology stack credit cost (all 6 agents) ─────────────────────
-- Task types: pricing_psychologist/upsell_architect/objection_killer/
--   testimonial_curator/scarcity_engineer → strategic_deep_copy (Claude-first)
-- hook_factory → structured_json (GPT-first)

SELECT
  SUM(amount)    AS total_psych_credits,
  COUNT(*)       AS agent_runs_charged,
  SUM(tokens_used) AS total_tokens,
  ROUND(SUM(cost_usd::numeric), 6) AS total_cost_usd
FROM credit_transactions
WHERE
  campaign_id = '<CAMPAIGN_ID>'
  AND idempotency_key LIKE '<CAMPAIGN_ID>:%'
  AND idempotency_key ~ '(pricing_psychologist|upsell_architect|objection_killer|testimonial_curator|scarcity_engineer|hook_factory|semente_launch)$';

-- ── 7. semente_launch — verify for semente_launch type campaigns ─────────────
-- Only relevant for campaigns with type = 'semente_launch'

SELECT
  ca.agent_type,
  ca.status,
  ca.started_at,
  ca.completed_at,
  (c.brain_data -> 'sementeLaunchPlan') IS NOT NULL AS has_launch_plan
FROM campaign_agents ca
JOIN campaigns c ON c.id = ca.campaign_id
WHERE ca.campaign_id = '<CAMPAIGN_ID>'
  AND ca.agent_type = 'semente_launch';
