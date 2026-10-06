// Database TCP remains enabled; fixtures may only use HTTP on loopback.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('External provider HTTP is disabled during homologation database regression tests');
  }
  return nativeFetch(input, options);
};
