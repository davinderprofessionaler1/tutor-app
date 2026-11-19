// LiveKit signaling admission gate. Keep the SFU HTTP port private: all public
// /rtc HTTP and websocket traffic must pass this gate, including reconnects.
import http from 'node:http';
import net from 'node:net';

const upstream = new URL(process.env.LIVEKIT_UPSTREAM ?? 'http://127.0.0.1:7880');
const api = process.env.CLASSROOM_API_URL ?? 'http://127.0.0.1:4000/api/v1/live/admission';
const port = Number(process.env.GATEWAY_PORT ?? 7882);
if (upstream.protocol !== 'http:') throw new Error('The private SFU upstream must use HTTP within the protected network. Terminate public TLS at the reverse proxy.');
async function admitted(request) {
  const url = new URL(request.url ?? '/', 'http://gateway');
  const token = url.searchParams.get('access_token') ?? request.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return false;
  try {
    const response = await fetch(api, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    return response.status === 204;
  } catch { return false; }
}
function privateHeaders(request) {
  const headers = { ...request.headers, host: upstream.host };
  delete headers['x-forwarded-for']; delete headers['x-forwarded-host'];
  return headers;
}
const server = http.createServer(async (request, response) => {
  if (request.url === '/health') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{"status":"ok"}'); return; }
  if (!await admitted(request)) { response.writeHead(403); response.end('Classroom access denied'); return; }
  const proxy = http.request({ hostname: upstream.hostname, port: upstream.port || 80, path: request.url, method: request.method, headers: privateHeaders(request) }, (result) => {
    response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response);
  });
  proxy.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end('Classroom unavailable'); });
  request.pipe(proxy);
});
server.on('upgrade', async (request, socket, head) => {
  socket.on('error', () => {});
  if (!await admitted(request)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
  const remote = net.connect(Number(upstream.port || 80), upstream.hostname);
  remote.on('error', () => { socket.destroy(); });
  socket.on('close', () => remote.destroy());
  remote.on('connect', () => {
    const headers = privateHeaders(request);
    remote.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${Object.entries(headers).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\r\n')}\r\n\r\n`);
    if (head.length) remote.write(head);
    socket.pipe(remote).pipe(socket);
  });
});
server.headersTimeout = 10000;
server.listen(port, process.env.GATEWAY_HOST ?? '127.0.0.1', () => console.log(`Classroom signaling gateway listening on ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
