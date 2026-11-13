import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { deviceLogin } from './kairogen-discover.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Uso: node scripts/kairogen-connect.mjs [--env-file .env.local]\nAutoriza leitura e geração e salva tokens no arquivo privado ignorado pelo Git. Não gera mídia.');
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== '--env-file' || !args[1])) throw new Error('Argumentos inválidos. Use --help.');
  const root = resolve(import.meta.dirname, '..');
  const target = resolve(args[1] || resolve(root, '.env.local'));
  if (!existsSync(target)) throw new Error('O arquivo de ambiente privado precisa existir.');
  const ignore = spawnSync('git', ['check-ignore', '--quiet', '--', target], { cwd: root });
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', target], { cwd: root });
  if (ignore.status !== 0 || tracked.status !== 1) throw new Error('O destino precisa estar ignorado pelo Git e fora dos arquivos versionados.');
  const env = { ...parseEnv(readFileSync(target, 'utf8')), ...process.env };
  const response = await fetch('https://api.kairogen.ai/.well-known/oauth-authorization-server', {
    redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Não foi possível descobrir o OAuth.');
  const metadata = await response.json();
  if (metadata.issuer !== 'https://api.kairogen.ai') throw new Error('Emissor OAuth inesperado.');
  for (const key of ['token_endpoint', 'registration_endpoint', 'device_authorization_endpoint']) {
    if (new URL(metadata[key]).origin !== metadata.issuer) throw new Error('Endpoint OAuth inesperado.');
  }
  await deviceLogin(metadata, {
    clientId: env.KAIROGEN_CLIENT_ID,
    scope: 'kairogen:read kairogen:generate',
    onAuthorized: async data => {
      if (data.scope && !data.scope.split(' ').includes('kairogen:generate')) throw new Error('Permissão de geração não concedida.');
      // Re-read after user authorization to preserve edits made while waiting.
      let content = readFileSync(target, 'utf8');
      const values = {
        KAIROGEN_ENABLED: 'true', KAIROGEN_ACCESS_TOKEN: data.access_token,
        KAIROGEN_REFRESH_TOKEN: data.refresh_token || '', KAIROGEN_CLIENT_ID: data.client_id,
        KAIROGEN_TOKEN_EXPIRES_AT: String(Date.now() + (Number(data.expires_in) || 3600) * 1000),
      };
      for (const [key, value] of Object.entries(values)) {
        const line = `${key}=${JSON.stringify(value)}`;
        const pattern = new RegExp(`^${key}=.*$`, 'm');
        content = pattern.test(content) ? content.replace(pattern, () => line) : content + (content.endsWith('\n') ? '' : '\n') + line + '\n';
      }
      const privateDirectory = resolve(root, '.tmp');
      mkdirSync(privateDirectory, { recursive: true });
      const temporary = resolve(privateDirectory, `kairogen-${randomUUID()}.env`);
      try {
        writeFileSync(temporary, content, { mode: 0o600 });
        renameSync(temporary, target);
      } finally { rmSync(temporary, { force: true }); }
      console.log(`Credenciais salvas em ${target}. Reinicie a API para carregar a configuração.`);
      console.log(data.refresh_token ? 'Renovação automática disponível; tokens rotacionados serão criptografados no Redis.' : 'O provedor não retornou refresh token; será necessário novo login ao expirar.');
    },
  });
}
main().catch(error => {
  // Do not print request bodies or errors containing upstream responses.
  console.error(error instanceof Error && !error.cause ? error.message : 'Falha na conexão OAuth. Confira a rede e tente novamente.');
  process.exitCode = 1;
});
