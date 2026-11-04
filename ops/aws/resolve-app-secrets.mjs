import { chown, chmod, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const region = 'us-east-2';
const supportedKeys = new Set([
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'NEXOS_OPENAI', 'GEMINI_API_KEY',
  'AI_INTEGRATIONS_ANTHROPIC_API_KEY', 'AI_INTEGRATIONS_OPENAI_API_KEY', 'AI_INTEGRATIONS_GEMINI_API_KEY',
  'RESEND_API_KEY', 'SMTP_PASSWORD', 'GMAIL_APP_PASSWORD',
  'INSTAGRAM_APP_SECRET', 'META_APP_SECRET', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'TIKTOK_CLIENT_SECRET', 'TIKTOK_ADS_APP_SECRET', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN',
  'HUBSPOT_CLIENT_SECRET', 'RD_STATION_CLIENT_SECRET', 'LINKEDIN_CLIENT_SECRET',
  'ASAAS_API_KEY', 'ASAAS_SANDBOX_API_KEY', 'ASAAS_WEBHOOK_TOKEN',
  'RUNWAY_API_KEY', 'FAL_API_KEY', 'HEYGEN_API_KEY', 'ELEVENLABS_API_KEY',
  'REGISTRAR_API_KEY', 'CLOUDFLARE_API_TOKEN', 'HOSTINGER_API_KEY',
  'SUPPLIER_WEBHOOK_SECRET', 'LANDING_DEPLOYMENT_TOKEN',
]);

function validateArn(value, name) {
  const match = /^arn:aws:secretsmanager:([a-z0-9-]+):(\d{12}):secret:[A-Za-z0-9/_+=.@-]+$/.exec(value);
  if (!match || match[1] !== region) throw new Error(`${name}: expected a Secrets Manager ARN in ${region}`);
}

function secretStringFromArn(arn, name) {
  validateArn(arn, name);
  const result = spawnSync('aws', [
    'secretsmanager', 'get-secret-value', '--secret-id', arn,
    '--region', region, '--output', 'json',
  ], { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${name}: could not read the configured Secrets Manager secret (check EC2 role, Region and ARN)`);
  }
  let response;
  try { response = JSON.parse(result.stdout); } catch { throw new Error(`${name}: Secrets Manager returned invalid JSON`); }
  if (typeof response.SecretString !== 'string' || !response.SecretString.trim()) {
    throw new Error(`${name}: secret must use a non-empty SecretString`);
  }
  return response.SecretString;
}

function parseProviderSecret(secret, name) {
  try {
    const parsed = JSON.parse(secret);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* A single-value secret may be plain text. */ }
  return { [name]: secret };
}

export async function materializeAppEnv(sourceFile, resolvedFile, externalSecretArn = '') {
  const source = parseEnv(await readFile(sourceFile, 'utf8'));
  const resolved = { ...source };
  const individualArnSuffix = '_ARN';
  const arnKeys = Object.keys(source).filter((key) => key.endsWith(individualArnSuffix) && source[key]?.trim());
  for (const arnKey of arnKeys) {
    const target = arnKey.slice(0, -individualArnSuffix.length);
    if (!supportedKeys.has(target)) throw new Error(`${arnKey}: unsupported secret reference`);
    if (source[target]?.trim()) throw new Error(`${target}: configure either a direct value or ${arnKey}, not both`);
  }

  if (externalSecretArn) {
    const payload = secretStringFromArn(externalSecretArn, 'NEXOS_EXTERNAL_APIS_SECRET_ARN');
    let entries;
    try { entries = JSON.parse(payload); } catch { throw new Error('NEXOS_EXTERNAL_APIS_SECRET_ARN: SecretString must be a JSON object'); }
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      throw new Error('NEXOS_EXTERNAL_APIS_SECRET_ARN: SecretString must be a JSON object');
    }
    for (const [key, value] of Object.entries(entries)) {
      if (!supportedKeys.has(key)) throw new Error(`External API secret contains unsupported key: ${key}`);
      if (typeof value !== 'string') throw new Error(`${key}: secret values must be strings`);
      if (!value.trim()) continue;
      if (!source[key]?.trim()) resolved[key] = value;
    }
  }

  for (const arnKey of arnKeys) {
    const target = arnKey.slice(0, -individualArnSuffix.length);
    const payload = secretStringFromArn(source[arnKey].trim(), arnKey);
    const entries = parseProviderSecret(payload, target);
    const value = entries[target] ?? entries.value;
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${arnKey}: SecretString must be plain text, {"value":"..."}, or {"${target}":"..."}`);
    }
    resolved[target] = value;
    delete resolved[arnKey];
  }

  const content = Object.entries(resolved)
    .filter(([key]) => !key.endsWith(individualArnSuffix))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n';
  const temporary = `${resolvedFile}.${process.pid}.tmp`;
  await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
  try {
    if (process.getuid?.() === 0) await chown(temporary, 1000, 1000);
    await chmod(temporary, 0o600);
    await rename(temporary, resolvedFile);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return { resolvedCount: arnKeys.length, grouped: Boolean(externalSecretArn), output: path.basename(resolvedFile) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [, , sourceFile, resolvedFile, externalSecretArn = ''] = process.argv;
  if (!sourceFile || !resolvedFile) throw new Error('Usage: resolve-app-secrets.mjs SOURCE_ENV RESOLVED_ENV [EXTERNAL_SECRET_ARN]');
  materializeAppEnv(sourceFile, resolvedFile, externalSecretArn)
    .then(({ resolvedCount, grouped, output }) => console.log(`Runtime environment materialized to ${output}; individual secrets: ${resolvedCount}; grouped secret: ${grouped ? 'yes' : 'no'}. Values were not printed.`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
