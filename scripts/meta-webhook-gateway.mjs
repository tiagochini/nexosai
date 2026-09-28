import http from "node:http";

const listenPort = Number(process.env.META_WEBHOOK_GATEWAY_PORT || "8090");
const apiPort = Number(process.env.META_WEBHOOK_API_PORT || "8080");
const allowedPaths = new Set([
  "/api/social/webhooks/meta",
  "/api/social-moderation/webhooks/meta",
]);

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (!allowedPaths.has(url.pathname) || !["GET", "POST"].includes(request.method || "")) {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const upstream = http.request({
    hostname: "127.0.0.1",
    port: apiPort,
    path: `${url.pathname}${url.search}`,
    method: request.method,
    headers: {
      ...request.headers,
      host: `127.0.0.1:${apiPort}`,
    },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "application/json" });
    }
    response.end(JSON.stringify({ error: "Local API unavailable" }));
  });
  request.pipe(upstream);
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(`Meta webhook gateway: http://127.0.0.1:${listenPort}`);
  console.log("Exposed paths: /api/social/webhooks/meta, /api/social-moderation/webhooks/meta");
});

function stop() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
