ALTER TABLE agent_execution_logs
  ADD COLUMN credits_debited integer;

-- Recover historical actual debits only when the execution and campaign-agent
-- records have a unique, exact match and their start times are within 2 minutes.
WITH candidate_pairs AS (
  SELECT
    e.id AS execution_id,
    ca.id AS agent_id,
    ca.credits_used,
    count(*) OVER (PARTITION BY e.id) AS execution_match_count,
    count(*) OVER (PARTITION BY ca.id) AS agent_match_count,
    row_number() OVER (
      PARTITION BY e.id
      ORDER BY abs(extract(epoch FROM (ca.started_at - e.started_at)))
    ) AS nearest_match
  FROM agent_execution_logs AS e
  JOIN campaign_agents AS ca
    ON ca.campaign_id = e.campaign_id
   AND ca.agent_type::text = e.agent_name
   AND ca.tokens_used = e.tokens_used
   AND ca.ai_provider = e.provider_used
   AND ca.started_at IS NOT NULL
   AND abs(extract(epoch FROM (ca.started_at - e.started_at))) <= 120
  WHERE e.execution_status = 'completed'
    AND e.credits_debited IS NULL
)
UPDATE agent_execution_logs AS e
SET credits_debited = candidate.credits_used
FROM candidate_pairs AS candidate
WHERE candidate.execution_id = e.id
  AND candidate.execution_match_count = 1
  AND candidate.agent_match_count = 1
  AND candidate.nearest_match = 1;
