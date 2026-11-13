import test from 'node:test';
import assert from 'node:assert/strict';
import { McpDiscovery, readRpc, redact, deviceLogin } from './kairogen-discover.mjs';

test('SSE fragmentado ignora notificações e encerra após a resposta correspondente', async () => {
  const encoder = new TextEncoder();
  const frames = ['event: message\r\ndata: {"jsonrpc":"2.0","method":"notice"}\r\n\r\n',
    'data: {"jsonrpc":"2.0","id":7,"result":{"tools":[]}}\r', '\n\r\n'];
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { for (const frame of frames) controller.enqueue(encoder.encode(frame)); },
    cancel() { cancelled = true; },
  });
  const message = await readRpc(new Response(body, { headers: { 'content-type': 'text/event-stream' } }), 7);
  assert.deepEqual(message.result, { tools: [] });
  assert.equal(cancelled, true);
});

test('descoberta usa sessão, versão negociada e paginação sem executar ferramentas', async () => {
  const calls = [];
  const client = new McpDiscovery({ token: 'private-token', fetcher: async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    assert.equal(options.headers.Authorization, 'Bearer private-token');
    assert.equal(options.redirect, 'error');
    if (request.method === 'initialize') return Response.json({ id: request.id, result: {
      protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fixture' },
    } }, { headers: { 'mcp-session-id': 'private-session' } });
    assert.equal(options.headers['Mcp-Session-Id'], 'private-session');
    assert.equal(options.headers['MCP-Protocol-Version'], '2025-06-18');
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 });
    assert.equal(request.method, 'tools/list');
    return Response.json({ id: request.id, result: request.params.cursor
      ? { tools: [{ name: 'generate_video', inputSchema: { type: 'object' } }] }
      : { tools: [{ name: 'generate_image' }], nextCursor: 'page2' } });
  } });
  const result = await client.discover();
  assert.equal(result.tools.length, 2);
  assert.deepEqual(calls.map(call => call.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/list']);
  await assert.rejects(client.rpc('tools/call', { name: 'generate_image' }), /bloqueado/);
});

test('401 não imprime o corpo e redação remove tokens e sessões', async () => {
  const client = new McpDiscovery({ fetcher: async () => new Response('sensitive body', { status: 401 }) });
  await assert.rejects(client.discover(), error => error.status === 401 && !error.message.includes('sensitive'));
  assert.deepEqual(redact({ access_token: 'abc', nested: { 'mcp-session-id': 'session', message: 'token=abc' } }, 'abc'),
    { access_token: '[REDACTED]', nested: { 'mcp-session-id': '[REDACTED]', message: 'token=[REDACTED]' } });
});

test('login por dispositivo pede somente leitura e respeita pending e slow_down', async () => {
  const intervals = [];
  const logs = [];
  let polls = 0;
  const token = await deviceLogin({
    device_authorization_endpoint: 'https://api.kairogen.ai/oauth/device_authorization',
    token_endpoint: 'https://api.kairogen.ai/oauth/token',
  }, {
    clientId: 'fixture-client', log: line => logs.push(line), pause: async ms => intervals.push(ms),
    fetcher: async (url, options) => {
      const body = new URLSearchParams(options.body);
      if (url.pathname.endsWith('device_authorization')) {
        assert.equal(body.get('scope'), 'kairogen:read');
        return Response.json({ device_code: 'secret-device', user_code: 'ABCD', verification_uri: 'https://app.kairogen.ai/activate', interval: 5, expires_in: 60 });
      }
      assert.equal(body.get('device_code'), 'secret-device');
      polls++;
      return polls < 3
        ? Response.json({ error: polls === 1 ? 'authorization_pending' : 'slow_down' }, { status: 400 })
        : Response.json({ access_token: 'secret-token' });
    },
  });
  assert.equal(token, 'secret-token');
  assert.deepEqual(intervals, [5000, 5000, 10000]);
  assert.equal(logs.join('').includes('secret-'), false);
});

test('inspeção chama somente as quatro consultas autorizadas e preserva falhas individuais', async () => {
  const calls = [];
  const client = new McpDiscovery({ inspect: true, fetcher: async (_url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    return Response.json({ id: request.id, result: request.params.name === 'get_credits'
      ? { isError: true, content: [{ type: 'text', text: 'read scope denied' }] }
      : { structuredContent: { items: [] } } });
  } });
  const names = ['list_models', 'get_me_context', 'get_credits', 'get_voices_data'];
  const result = await client.inspectAccount(names.map(name => ({ name, annotations: { readOnlyHint: true } })));
  assert.deepEqual(calls.map(call => call.params.name), names);
  assert.equal(result.get_credits.ok, false);
  assert.equal(result.get_voices_data.ok, true);
  for (const params of [{ name: 'generate_image', arguments: {} }, { name: 'change_plan', arguments: {} },
    { name: 'list_models', arguments: { injected: true } }]) {
    await assert.rejects(client.rpc('tools/call', params), /bloqueado/);
  }
  assert.equal(calls.length, 4);
});

test('inspeção bloqueia ferramenta que perdeu indicação de somente leitura', async () => {
  let called = false;
  const client = new McpDiscovery({ inspect: true, fetcher: async () => { called = true; throw new Error('unexpected'); } });
  const results = await client.inspectAccount([{ name: 'list_models', annotations: { readOnlyHint: true, destructiveHint: true } }]);
  assert.equal(called, false);
  assert.ok(Object.values(results).every(item => item.error));
});

test('conexão permanente solicita geração explicitamente e entrega credenciais só ao callback privado', async () => {
  const logs = [];
  let credentials;
  await deviceLogin({ registration_endpoint: 'https://api.kairogen.ai/oauth/register',
    device_authorization_endpoint: 'https://api.kairogen.ai/oauth/device_authorization', token_endpoint: 'https://api.kairogen.ai/oauth/token' }, {
    scope: 'kairogen:read kairogen:generate', pause: async () => {}, log: line => logs.push(line),
    onAuthorized: async data => { credentials = data; },
    fetcher: async (url, options) => {
      if (url.pathname.endsWith('register')) {
        const data = JSON.parse(options.body);
        assert.ok(data.grant_types.includes('refresh_token'));
        assert.equal(data.scope, 'kairogen:read kairogen:generate');
        return Response.json({ client_id: 'fixture-client' });
      }
      const form = new URLSearchParams(options.body);
      if (url.pathname.endsWith('device_authorization')) {
        assert.equal(form.get('scope'), 'kairogen:read kairogen:generate');
        return Response.json({ device_code: 'private-device', user_code: 'CODE', verification_uri: 'https://app.kairogen.ai/device' });
      }
      return Response.json({ access_token: 'private-access', refresh_token: 'private-refresh' });
    },
  });
  assert.equal(credentials.client_id, 'fixture-client');
  assert.equal(credentials.refresh_token, 'private-refresh');
  assert.equal(logs.join('').includes('private-'), false);
});
