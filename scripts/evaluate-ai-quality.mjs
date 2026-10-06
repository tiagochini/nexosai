import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function gradeArtifact(spec, candidate, promptSha256, minimumScore = 85) {
  const text = typeof candidate?.text === 'string' ? candidate.text : '';
  const normalized = normalize(text), artifactSha256 = hash(text);
  const checks = {
    structure: text.trim().split(/\s+/).length >= spec.minimumWords && candidate?.artifact === spec.artifact,
    facts: spec.requiredFacts.every(fact => normalized.includes(normalize(fact))),
    action: spec.cta.some(cta => normalized.includes(normalize(cta))),
    safety: text.length > 0 && !spec.forbiddenClaims.some(claim => normalized.includes(normalize(claim))) &&
      !/ignore (previous|all) instructions|ignore as instrucoes|\b(sk-[a-zA-Z0-9_-]{16,}|Bearer\s+[\w.-]{16,})|<script\b/i.test(text),
  };
  const score = (checks.structure ? 25 : 0) + (checks.facts ? 25 : 0) + (checks.action ? 20 : 0) + (checks.safety ? 30 : 0);
  const provenance = candidate?.generationMode === 'live' && typeof candidate.model === 'string' && candidate.model.length > 0 &&
    candidate.promptSha256 === promptSha256 && Number.isFinite(Date.parse(candidate.generatedAt));
  const human = candidate?.review;
  const dimensions = ['relevance', 'clarity', 'factuality', 'brandVoice'];
  const ratings = dimensions.map(name => human?.ratings?.[name]);
  const humanScore = ratings.every(value => Number.isInteger(value) && value >= 3 && value <= 5) && ratings.reduce((total, value) => total + value, 0) / ratings.length >= 4;
  const humanApproved = human?.decision === 'approved' && typeof human.reviewer === 'string' && human.reviewer.trim().length >= 3 &&
    human.artifactSha256 === artifactSha256 && human.promptSha256 === promptSha256 && human.model === candidate.model &&
    Number.isFinite(Date.parse(human.reviewedAt)) && Date.parse(human.reviewedAt) >= Date.parse(candidate.generatedAt) && humanScore;
  const automaticPass = checks.safety && checks.facts && checks.action && score >= minimumScore;
  return { id: spec.id, artifact: spec.artifact, artifactSha256, promptSha256, score, checks, automaticPass,
    provenance: Boolean(provenance), humanApproved: Boolean(humanApproved), releaseEligible: Boolean(automaticPass && provenance && humanApproved) };
}
export async function evaluateCandidates(candidates) {
  const dataset = JSON.parse(await readFile(path.join(root, 'evals/ai-quality/v1/cases.json'), 'utf8'));
  const results = [];
  for (const spec of dataset.cases) {
    const prompt = await readFile(path.join(root, 'artifacts/api-server/src/modules/agents', spec.promptSource));
    const candidate = candidates.find(value => value.id === spec.id);
    results.push(gradeArtifact(spec, candidate, hash(prompt), dataset.minimumScore));
  }
  return { datasetVersion: dataset.version, generatedAt: new Date().toISOString(), minimumScore: dataset.minimumScore,
    releaseEligible: results.every(result => result.releaseEligible), results };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: evaluate-ai-quality.mjs candidates.json report.json');
  const candidates = JSON.parse(await readFile(input, 'utf8'));
  if (!Array.isArray(candidates)) throw new Error('Candidates must be an array');
  const result = await evaluateCandidates(candidates); await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(`AI quality: ${result.results.length} artifacts; release ${result.releaseEligible ? 'eligible' : 'blocked'}`);
  process.exitCode = result.releaseEligible ? 0 : 2;
}
