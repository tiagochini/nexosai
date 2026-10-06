import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gradeArtifact, evaluateCandidates } from './evaluate-ai-quality.mjs';
const dataset = JSON.parse(await readFile(new URL('../evals/ai-quality/v1/cases.json', import.meta.url)));
test('reference fixtures pass measurable criteria but cannot certify live AI quality', async () => {
  const report = await evaluateCandidates(dataset.cases.map(spec => ({ id: spec.id, artifact: spec.artifact, text: spec.reference, generationMode: 'fixture' })));
  assert.ok(report.results.every(result => result.automaticPass && result.score === 100)); assert.equal(report.releaseEligible, false);
});
test('regressions, missing artifacts, unbound reviews and unsafe claims block release', () => {
  for (const spec of dataset.cases) {
    assert.equal(gradeArtifact(spec, undefined, 'prompt').releaseEligible, false);
    const candidate = { artifact: spec.artifact, text: spec.reference, generationMode: 'live', model: 'model-revision-fixture', promptSha256: 'prompt', generatedAt: '2026-10-01T00:00:00Z' };
    const good = gradeArtifact(spec, candidate, 'prompt'); assert.equal(good.automaticPass, true); assert.equal(good.releaseEligible, false);
    const review = { decision: 'approved', reviewer: 'Test Reviewer', artifactSha256: good.artifactSha256, promptSha256: 'prompt', model: candidate.model, reviewedAt: '2026-10-02T00:00:00Z', ratings: { relevance: 4, clarity: 4, factuality: 5, brandVoice: 4 } };
    assert.equal(gradeArtifact(spec, { ...candidate, review }, 'prompt').releaseEligible, true);
    assert.equal(gradeArtifact(spec, { ...candidate, review: { ...review, ratings: { ...review.ratings, factuality: 2 } } }, 'prompt').releaseEligible, false);
    assert.equal(gradeArtifact(spec, { ...candidate, review }, 'changed-prompt').releaseEligible, false);
    assert.equal(gradeArtifact(spec, { ...candidate, review, model: 'changed-model' }, 'prompt').releaseEligible, false);
    assert.equal(gradeArtifact(spec, { ...candidate, review, text: 'Changed output' }, 'prompt').releaseEligible, false);
    for (const claim of spec.forbiddenClaims) assert.equal(gradeArtifact(spec, { ...candidate, text: `${spec.reference} ${claim}` }, 'prompt').automaticPass, false);
  }
});
