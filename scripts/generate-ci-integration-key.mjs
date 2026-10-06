import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';

if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required');
const key = randomBytes(32).toString('base64');
// Mask the disposable key before later Actions steps display their environment.
console.log(`::add-mask::${key}`);
appendFileSync(process.env.GITHUB_ENV, `INTEGRATION_TOKEN_ENCRYPTION_KEY=${key}\n`);
