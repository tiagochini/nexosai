import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { db, nativeMediaJobsTable, nativeMediaWorkerNoncesTable } from '@workspace/db';
import { env } from '../../lib/env.js';
import { AppError } from '../../lib/errors.js';
type Job = typeof nativeMediaJobsTable.$inferSelect;
type Scope = { workspaceId: string; workerId: string; jobId: string; lease: string; method: string; resource: string; sha256?: string; expires: number; nonce: string };
const signature = (body: string) => createHmac('sha256', env.JWT_SECRET).update(`native-object-v1:${body}`).digest();
function issue(job: Job, method: string, resource: string, sha256?: string) {
  const scope: Scope = { workspaceId: job.workspaceId, workerId: job.leasedWorkerId!, jobId: job.id, lease: job.leaseToken!, method, resource, sha256,
    expires: Math.min(Date.now() + 60_000, job.leaseExpiresAt!.getTime()), nonce: randomUUID() };
  const body = Buffer.from(JSON.stringify(scope)).toString('base64url');
  return { method, resource, sha256, expiresAt: new Date(scope.expires).toISOString(), grant: `${body}.${signature(body).toString('base64url')}` };
}
export function nativeObjectGrants(job: Job) {
  const inputs = job.inputObjects as Array<{ sha256: string }>;
  return { inputs: inputs.map((input, index) => issue(job, 'GET', `inputs/${index}`, input.sha256)), output: issue(job, 'PUT', 'output') };
}
export async function consumeNativeObjectGrant(token: string, job: Job, method: string, resource: string) {
  const reject = () => new AppError(403, 'Object grant is invalid or expired', 'INVALID_OBJECT_GRANT');
  if (token.length > 4096) throw reject();
  const [body, mac, extra] = token.split('.'); if (!body || !mac || extra) throw reject();
  const supplied = Buffer.from(mac, 'base64url'), expected = signature(body);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw reject();
  let scope: Scope; try { scope = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw reject(); }
  if (scope.workspaceId !== job.workspaceId || scope.workerId !== job.leasedWorkerId || scope.jobId !== job.id || scope.lease !== job.leaseToken ||
    scope.method !== method || scope.resource !== resource || !Number.isFinite(scope.expires) || scope.expires <= Date.now() || !/^[\da-f-]{36}$/.test(scope.nonce)) throw reject();
  if (method === 'GET') {
    const input = (job.inputObjects as Array<{ sha256: string }>)[Number(resource.split('/')[1])];
    if (!input || input.sha256 !== scope.sha256) throw reject();
  }
  try { await db.insert(nativeMediaWorkerNoncesTable).values({ workspaceId: job.workspaceId, workerId: job.leasedWorkerId!, nonce: `grant:${scope.nonce}`, expiresAt: new Date(scope.expires) }); }
  catch { throw new AppError(409, 'Object grant already consumed or unavailable', 'OBJECT_GRANT_CONSUMED'); }
}
