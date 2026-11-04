import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeGroupedIntegrationConfig } from './resolve-app-secrets.mjs';

test('the grouped secret replaces legacy integration env values and preserves core runtime settings', async () => {
  const example = JSON.parse(await readFile(new URL('./external-apis.secret.example.json', import.meta.url), 'utf8'));
  const resolved = mergeGroupedIntegrationConfig({
    DATABASE_URL: 'postgresql://runtime/db',
    APP_URL: 'https://agencianexos.vip',
    OPENAI_API_KEY: 'old-value-from-app-env',
    SMTP_HOST: 'old-mail-host',
    CLOUDFLARE_API_TOKEN: 'old-cloudflare-token',
  }, {
    ...example,
    OPENAI_API_KEY: 'new-value-from-grouped-secret',
    ANTHROPIC_API_KEY: 'anthropic-key',
  });

  assert.equal(resolved.DATABASE_URL, 'postgresql://runtime/db');
  assert.equal(resolved.APP_URL, 'https://agencianexos.vip');
  assert.equal(resolved.OPENAI_API_KEY, 'new-value-from-grouped-secret');
  assert.equal(resolved.ANTHROPIC_API_KEY, 'anthropic-key');
  assert.equal(resolved.SMTP_HOST, undefined);
  assert.equal(resolved.CLOUDFLARE_API_TOKEN, undefined);
  assert.equal(resolved.SMTP_PORT, '465');
});

test('the AI integration accepts all Anthropic settings from the one secret', () => {
  const resolved = mergeGroupedIntegrationConfig({
    ANTHROPIC_API_KEY: 'stale-key',
    ANTHROPIC_WORKSPACE_ID: 'stale-workspace',
    AI_INTEGRATIONS_ANTHROPIC_BASE_URL: 'https://stale.invalid',
    AI_INTEGRATIONS_ANTHROPIC_API_KEY: 'stale-proxy-key',
  }, {
    ANTHROPIC_API_KEY: 'current-key',
    ANTHROPIC_WORKSPACE_ID: 'workspace-id',
    AI_INTEGRATIONS_ANTHROPIC_BASE_URL: 'https://anthropic.example/v1',
    AI_INTEGRATIONS_ANTHROPIC_API_KEY: 'current-proxy-key',
  });

  assert.equal(resolved.ANTHROPIC_API_KEY, 'current-key');
  assert.equal(resolved.ANTHROPIC_WORKSPACE_ID, 'workspace-id');
  assert.equal(resolved.AI_INTEGRATIONS_ANTHROPIC_BASE_URL, 'https://anthropic.example/v1');
  assert.equal(resolved.AI_INTEGRATIONS_ANTHROPIC_API_KEY, 'current-proxy-key');
});

test('the grouped secret rejects unknown keys and non-string settings without showing values', () => {
  assert.throws(
    () => mergeGroupedIntegrationConfig({}, { OPENAI_API_KEY: 123 }),
    /OPENAI_API_KEY: integration settings must be strings/,
  );
  assert.throws(
    () => mergeGroupedIntegrationConfig({}, { UNKNOWN_PROVIDER_KEY: 'do-not-print-this' }),
    /unsupported key: UNKNOWN_PROVIDER_KEY/,
  );
});
