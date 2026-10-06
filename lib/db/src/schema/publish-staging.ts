/**
 * Temporary two-publish schema staging for the managed production database.
 *
 * Phase 1 (true): publish parent composite unique keys while the newly added
 * tenant-scoped composite foreign keys are omitted. Existing scalar primary-key
 * foreign keys and application-level workspace checks remain in effect.
 *
 * Phase 2: AFTER the first publish has completed and the parent keys are
 * confirmed in production, set this to false, sync the development schema and
 * publish again. Do not leave phase 1 enabled as a permanent schema design.
 */
export const PUBLISH_STAGE_ONE = false;
