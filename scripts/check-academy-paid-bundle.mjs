import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
const content = path.join(root, 'artifacts/api-server/src/modules/academy/content');
async function exported(file) {
  const source = await fs.readFile(path.join(content, file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  return exports;
}
const { CURRICULUM } = await exported('curriculum.ts');
const lessons = CURRICULUM.flatMap(m => m.chapters.flatMap(c => c.lessons));
const canaries = lessons.flatMap(l => [l.content, l.exercise, ...l.keyPoints]).filter(Boolean)
  .map(text => text.replace(/<[^>]*>/g, '').trim()).filter(text => text.length > 80).map(text => text.slice(0, 100));
canaries.push('A autoridade não é dada, é tomada.', 'Resultado: 4 pagaram em 15 minutos.');
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const files = await walk(path.join(root, 'artifacts/nexos-academy/dist/public'));
let checked = 0;
for (const file of files.filter(file => /\.(?:js|html|json|map)$/.test(file))) {
  const source = await fs.readFile(file, 'utf8');
  for (const canary of canaries) assert.ok(!source.includes(canary) && !source.includes(JSON.stringify(canary).slice(1, -1)), `Paid text leaked in ${path.relative(root, file)}`);
  checked++;
}
assert.ok(checked > 0, 'Build Academy before checking paid content');
console.log(`PASS Academy paid bundle: ${canaries.length} content canaries absent from ${checked} public artifacts`);
