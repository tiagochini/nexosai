---
name: Workspace Settings JSON Path
description: Critical SQL path bug — workspace persona fields are nested under settings.persona, not at settings root
---

## Rule

When querying workspace persona fields from PostgreSQL, always use the nested path:

```sql
settings->'persona'->>'heygenAvatarId'
settings->'persona'->>'heygenVoiceId'
settings->'persona'->>'voiceCloneId'
settings->'persona'->>'avatarType'
settings->'persona'->>'digitalTwinId'
```

**NOT** the root-level path:
```sql
settings->>'heygenAvatarId'   -- WRONG: always returns NULL
```

The `persona` object lives at `workspaces.settings.persona`, not at `workspaces.settings` root.

**Why:** Queried with the wrong path in W4 and got NULL for all fields, incorrectly concluded the workspace had no persona configured. The workspace actually had a complete digital_twin persona with heygenAvatarId, heygenVoiceId, and avatarTrainingStatus="complete". This caused a completely wrong analysis of why HeyGen wasn't called.

**How to apply:** Any time reading persona fields from workspaces table via raw SQL. The application code uses `getWorkspacePersona()` which handles the nesting correctly — this bug only appears in direct SQL queries.

**Correct query example:**
```sql
SELECT
  settings->'persona'->>'heygenAvatarId'     AS avatar_id,
  settings->'persona'->>'heygenVoiceId'      AS voice_id,
  settings->'persona'->>'voiceCloneId'       AS voice_clone_id,
  settings->'persona'->>'avatarType'         AS avatar_type,
  settings->'persona'->>'digitalTwinId'      AS digital_twin_id,
  settings->'persona'->>'avatarTrainingStatus' AS training_status
FROM workspaces WHERE id = '...';
```

Or use the top-level accessor to get the full JSON at once:
```sql
SELECT settings->'persona' AS persona FROM workspaces WHERE id = '...';
```
