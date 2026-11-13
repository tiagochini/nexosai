import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENDPOINT = 'https://mcp.kairogen.ai/mcp';
const VERSION = '2025-06-18';
const INSPECTION_CALLS = [
  ['list_models', {}], ['get_me_context', {}], ['get_credits', {}],
  ['get_voices_data', { source: 'all', limit: 100 }],
];

function safeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('A descoberta aceita apenas URLs HTTPS sem credenciais.');
  }
  return url;
}

export function redact(value, token = '') {
  if (typeof value === 'string') return token ? value.split(token).join('[REDACTED]') : value;
  if (Array.isArray(value)) return value.map(item => redact(item, token));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      /^(access_token|refresh_token|id_token|client_secret|authorization|mcp-session-id|device_code)$/i.test(key)
        ? '[REDACTED]' : redact(item, token),
    ]));
  }
  return value;
}

export async function readRpc(response, id) {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const message = await response.json();
    if (message.id !== id) throw new Error('Resposta JSON-RPC com ID inesperado.');
    return message;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  const consume = frame => {
    const payload = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!payload) return undefined;
    const message = JSON.parse(payload);
    return message.id === id ? message : undefined;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        bytes += value.length;
        if (bytes > 16 * 1024 * 1024) throw new Error('Resposta SSE excedeu 16 MiB.');
      }
      buffer += decoder.decode(value, { stream: !done });
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const result = consume(frame);
        if (result) return result;
      }
      if (done) {
        const result = consume(buffer);
        if (result) return result;
        throw new Error('Stream SSE terminou sem a resposta JSON-RPC esperada.');
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export class McpDiscovery {
  constructor({ endpoint = ENDPOINT, token = '', fetcher = fetch, timeout = 20000, inspect = false } = {}) {
    this.endpoint = safeUrl(endpoint).href;
    this.token = token;
    this.fetcher = fetcher;
    this.timeout = timeout;
    this.sequence = 0;
    this.inspect = inspect;
  }

  async rpc(method, params = {}, notification = false) {
    // Permit only the exact read-only calls requested by the inspection mode.
    const allowedInspection = this.inspect && !notification && method === 'tools/call'
      && INSPECTION_CALLS.some(([name, args]) => name === params.name && JSON.stringify(args) === JSON.stringify(params.arguments))
      && Object.keys(params).every(key => ['name', 'arguments'].includes(key));
    if (!allowedInspection && !['initialize', 'notifications/initialized', 'tools/list', 'resources/list', 'prompts/list'].includes(method)) {
      throw new Error('Método bloqueado pelo script de descoberta.');
    }
    const id = notification ? undefined : ++this.sequence;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    if (this.version) headers['MCP-Protocol-Version'] = this.version;
    const response = await this.fetcher(this.endpoint, {
      method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(this.timeout),
      body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method, params }),
    });
    const session = response.headers.get('mcp-session-id');
    if (session) this.session = session;
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(`MCP respondeu HTTP ${response.status} em ${method}.`);
      error.status = response.status;
      throw error;
    }
    if (notification) {
      await response.body?.cancel();
      return;
    }
    const message = await readRpc(response, id);
    if (message.error) throw new Error(`Erro JSON-RPC ${message.error.code} em ${method}.`);
    if (!message.result || typeof message.result !== 'object') throw new Error('Resultado MCP inválido.');
    return message.result;
  }

  async list(method, key) {
    const items = [];
    const cursors = new Set();
    let cursor;
    for (let page = 0; page < 100; page++) {
      const result = await this.rpc(method, cursor ? { cursor } : {});
      if (!Array.isArray(result[key])) throw new Error(`Lista ${key} inválida.`);
      items.push(...result[key]);
      cursor = result.nextCursor;
      if (!cursor) return items;
      if (cursors.has(cursor)) throw new Error('Cursor MCP repetido.');
      cursors.add(cursor);
    }
    throw new Error('Limite de 100 páginas atingido.');
  }

  async discover() {
    const initialization = await this.rpc('initialize', {
      protocolVersion: VERSION, capabilities: {},
      clientInfo: { name: 'nexos-kairogen-discovery', version: '1.0.0' },
    });
    this.version = initialization.protocolVersion;
    if (typeof this.version !== 'string') throw new Error('Servidor não informou a versão MCP.');
    await this.rpc('notifications/initialized', {}, true);
    const result = { initialization };
    const capabilities = initialization.capabilities ?? {};
    for (const [key, method] of [['tools', 'tools/list'], ['resources', 'resources/list'], ['prompts', 'prompts/list']]) {
      if (capabilities[key]) {
        try { result[key] = await this.list(method, key); }
        catch (error) { (result.errors ??= []).push({ method, message: error.message }); }
      }
    }
    return result;
  }

  async inspectAccount(tools, onAttempt = () => {}) {
    if (!this.inspect) throw new Error('Inspeção não habilitada.');
    const results = {};
    for (const [name, args] of INSPECTION_CALLS) {
      const tool = tools?.find(item => item.name === name);
      if (!tool || tool.annotations?.readOnlyHint !== true || tool.annotations?.destructiveHint === true) {
        results[name] = { error: 'Ferramenta ausente ou não anunciada como somente leitura.' };
        continue;
      }
      try {
        onAttempt(name);
        const result = await this.rpc('tools/call', { name, arguments: args });
        results[name] = { ok: !result.isError, result };
      } catch (error) {
        results[name] = { error: error.message, status: error.status };
      }
    }
    return results;
  }
}

async function metadata(url) {
  try {
    const response = await fetch(safeUrl(url), {
      headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { url, status: response.status };
    }
    return { url, status: response.status, document: await response.json() };
  } catch (error) {
    return { url, error: error.message, cause: error.cause?.code };
  }
}

export async function deviceLogin(server, { clientId, scope = 'kairogen:read', onAuthorized, fetcher = fetch, log = console.log, pause = ms => new Promise(done => setTimeout(done, ms)) } = {}) {
  if (!server?.device_authorization_endpoint || !server.token_endpoint) throw new Error('Device OAuth não anunciado.');
  const post = async (endpoint, body, json = false) => {
    const response = await fetcher(safeUrl(endpoint), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json', 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' },
      body: json ? JSON.stringify(body) : new URLSearchParams(body).toString(),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  };
  if (!clientId) {
    if (!server.registration_endpoint) throw new Error('Configure KAIROGEN_CLIENT_ID; registro dinâmico não anunciado.');
    const registration = await post(server.registration_endpoint, {
      client_name: 'Nexos capability discovery',
      grant_types: ['urn:ietf:params:oauth:grant-type:device_code', ...(onAuthorized ? ['refresh_token'] : [])],
      token_endpoint_auth_method: 'none', scope,
    }, true);
    if (!registration.ok || !registration.data.client_id) throw new Error('Registro OAuth recusado. Solicite um KAIROGEN_CLIENT_ID ao provedor.');
    clientId = registration.data.client_id;
  }
  const { ok, data: device } = await post(server.device_authorization_endpoint, { client_id: clientId, scope });
  if (!ok || !device.device_code || !device.user_code || !device.verification_uri) throw new Error('Não foi possível iniciar o login por dispositivo.');
  log(`Abra no navegador: ${safeUrl(device.verification_uri).href}`);
  log(`Código de autorização: ${device.user_code}`);
  log(onAuthorized ? 'Autorize a conta KAIROGEN. As credenciais serão salvas no arquivo privado selecionado.' : 'Autorize a conta KAIROGEN. O token será mantido apenas na memória desta execução.');
  let interval = Math.max(5, Number(device.interval) || 5);
  const deadline = Date.now() + Math.min(600, Math.max(1, Number(device.expires_in) || 300)) * 1000;
  while (Date.now() < deadline) {
    await pause(interval * 1000);
    if (Date.now() >= deadline) break;
    const result = await post(server.token_endpoint, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: device.device_code, client_id: clientId,
    });
    if (result.ok && result.data.access_token) {
      if (onAuthorized) await onAuthorized({ ...result.data, client_id: clientId });
      return result.data.access_token;
    }
    if (result.data.error === 'authorization_pending') continue;
    if (result.data.error === 'slow_down') { interval += 5; continue; }
    throw new Error('Autorização recusada ou expirada. Execute --login novamente.');
  }
  throw new Error('Tempo de autorização expirado. Execute --login novamente.');
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log(`Uso: node scripts/kairogen-discover.mjs [--public-only | --login] [--inspect] [--env-file arquivo] [--out arquivo]\n\nVariáveis: KAIROGEN_ACCESS_TOKEN (OAuth Bearer, opcional), KAIROGEN_CLIENT_ID (opcional), KAIROGEN_MCP_URL (opcional).\n--login: autorização por código de dispositivo, com escopo kairogen:read.\n--inspect: consulta somente list_models, get_me_context, get_credits e get_voices_data. Não gera mídia.\nSem --inspect: lista ferramentas, schemas, recursos e prompts sem executar tools/call.\nRelatório padrão: tmp/kairogen-discovery.json ou tmp/kairogen-inspection.json (--inspect). Nenhum token ou ID de sessão é salvo.`);
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--public-only') options.publicOnly = true;
    else if (args[i] === '--login') options.login = true;
    else if (args[i] === '--inspect') options.inspect = true;
    else if (['--env-file', '--out'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i].slice(2)] = args[++i];
    else throw new Error(`Argumento inválido: ${args[i]}`);
  }
  if (options.login && options.publicOnly) throw new Error('--login e --public-only são incompatíveis.');
  if (options.inspect && options.publicOnly) throw new Error('--inspect exige autenticação.');
  const root = resolve(import.meta.dirname, '..');
  const file = options['env-file'] ? resolve(options['env-file']) : resolve(root, '.env.local');
  if (options['env-file'] && !existsSync(file)) throw new Error('Arquivo de ambiente não encontrado.');
  const env = { ...(existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}), ...process.env };
  let token = options.publicOnly ? '' : (env.KAIROGEN_ACCESS_TOKEN ?? '').trim();
  if (options.inspect && !options.login && !token) throw new Error('Use --login --inspect ou configure KAIROGEN_ACCESS_TOKEN.');
  const endpoint = safeUrl(env.KAIROGEN_MCP_URL || ENDPOINT);
  const report = {
    timestamp: new Date().toISOString(), endpoint: endpoint.href,
    authenticatedAttempt: Boolean(token), toolsExecuted: false, inspectionCallsAttempted: [],
    protectedResource: await metadata(new URL('/.well-known/oauth-protected-resource', endpoint).href),
  };
  // Discover authorization servers from published metadata; never guess token routes.
  const issuers = report.protectedResource.document?.authorization_servers ?? [];
  report.authorizationServers = [];
  for (const issuer of issuers.slice(0, 5)) {
    try {
      const url = safeUrl(issuer);
      const path = url.pathname.replace(/\/$/, '');
      report.authorizationServers.push(await metadata(`${url.origin}/.well-known/oauth-authorization-server${path}`));
    } catch { report.authorizationServers.push({ error: 'Issuer inválido nos metadados.' }); }
  }
  try {
    if (options.login) {
      const server = report.authorizationServers.find(item => item.document)?.document;
      token = await deviceLogin(server, { clientId: env.KAIROGEN_CLIENT_ID });
      report.authenticatedAttempt = true;
    }
    const client = new McpDiscovery({ endpoint: endpoint.href, token, inspect: options.inspect });
    report.mcp = await client.discover();
    if (report.mcp.errors?.length) process.exitCode = 1;
    if (options.inspect) {
      report.inspection = await client.inspectAccount(report.mcp.tools, name => {
        report.toolsExecuted = true;
        report.inspectionCallsAttempted.push(name);
        console.log(`Consultando ${name}...`);
      });
      if (Object.values(report.inspection).some(item => item.error || !item.ok)) process.exitCode = 1;
    }
  } catch (error) {
    report.mcp = { error: error.message, status: error.status, cause: error.cause?.code };
    process.exitCode = 1;
  }
  const output = resolve(options.out || resolve(root, options.inspect ? 'tmp/kairogen-inspection.json' : 'tmp/kairogen-discovery.json'));
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify(redact(report, token), null, 2) + '\n', { mode: 0o600 });
  console.log(`Relatório: ${output}`);
  console.log(`Autenticação Bearer: ${token ? 'configurada' : 'não configurada'}`);
  if (report.mcp.tools) {
    console.log(`Ferramentas encontradas: ${report.mcp.tools.length}`);
    if (!options.inspect) for (const tool of report.mcp.tools) console.log(`- ${redact(tool.name, token)}`);
  }
  if (report.inspection) for (const [name, item] of Object.entries(report.inspection)) {
    console.log(`${name}: ${item.ok ? 'OK' : 'FALHOU (consulte o relatório)'}`);
  }
  if (report.mcp.error) console.log(`MCP: ${redact(report.mcp.error, token)} ${report.mcp.cause ?? ''}`);
  if (report.mcp.status === 401 || report.mcp.status === 403) {
    console.log('Forneça um token OAuth válido em KAIROGEN_ACCESS_TOKEN no arquivo de ambiente privado e repita.');
  }
  console.log(report.toolsExecuted ? 'Executadas somente consultas de leitura; nenhuma geração foi solicitada.' : 'Nenhuma ferramenta foi executada; nenhuma geração foi solicitada.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Falha na descoberta. Confira os argumentos (--help), o arquivo de ambiente e as permissões de escrita.');
    process.exitCode = 1;
  });
}
