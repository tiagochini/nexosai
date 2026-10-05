import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const logLevels = new Set(["trace", "debug", "info", "warn", "error", "fatal"]);
const normalize = (key) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();
const rawFields = new Set(["text", "msg", "message", "lastError", "errText", "errorMessage", "contractWarn", "response", "result", "body", "payload", "prompt", "stdout", "stderr", "data", "preview", "rawPreview", "rawTail", "feedback", "geminiData", "videoData", "failureMsg"].map(normalize));

export function inspectRuntimeLogging(source, filename) {
  const syntax = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const findings = [];
  let calls = 0;
  function report(node, rule) {
    const location = syntax.getLineAndCharacterOfPosition(node.getStart(syntax));
    findings.push({ file: filename, line: location.line + 1, rule });
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(syntax);
      const method = node.expression.name.text;
      if (/(?:^|\.)console$/.test(owner) && ["log", "warn", "error", "info", "debug", "trace", "dir", "table"].includes(method)) {
        report(node, "Use the protected logger instead of console in runtime API code");
      }
      if (["process.stdout", "process.stderr"].includes(owner) && method === "write") report(node, "Direct runtime stdout/stderr output bypasses the protected logger");
      if (/log/i.test(owner) && logLevels.has(method)) {
        calls++;
        const metadata = node.arguments[0];
        if (metadata && ts.isObjectLiteralExpression(metadata)) {
          for (const property of metadata.properties) {
            const name = property.name;
            const key = name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text
              : name && ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression) ? name.expression.text : undefined;
            if (key && rawFields.has(normalize(key))) report(property, `Raw log field '${key}' is forbidden; use IDs/status/counts or protected err metadata`);
          }
        }
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "pino") {
      const clause = node.importClause;
      const typeOnly = clause?.isTypeOnly || (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
        && clause.namedBindings.elements.every((element) => element.isTypeOnly) && !clause.name);
      if (!filename.replaceAll("\\", "/").endsWith("/lib/logger.ts") && !typeOnly) {
        report(node, "Runtime Pino instances must use the central protected logger");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return { calls, findings };
}

async function runtimeFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "scripts") result.push(...await runtimeFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".ts")) result.push(target);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files = await runtimeFiles(path.join(root, "artifacts/api-server/src"));
  let calls = 0;
  const findings = [];
  for (const file of files) {
    const result = inspectRuntimeLogging(await readFile(file, "utf8"), path.relative(root, file));
    calls += result.calls;
    findings.push(...result.findings);
  }
  for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.rule}`);
  if (findings.length) process.exitCode = 1;
  else console.log(`Runtime logging guard passed: ${files.length} API files, ${calls} structured calls checked (diagnostic scripts excluded).`);
}
