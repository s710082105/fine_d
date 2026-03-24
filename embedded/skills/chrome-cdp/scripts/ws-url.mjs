import { existsSync, readFileSync, writeFileSync } from 'fs';

const DEFAULT_CDP_HOST = '127.0.0.1';
const DEFAULT_CDP_DEBUG_PORT = '9222';

export function parseDevToolsPortFile(content, portFile, host = DEFAULT_CDP_HOST) {
  const lines = content.trim().split('\n');
  if (lines.length < 2 || !lines[0] || !lines[1]) {
    throw new Error(`Invalid DevToolsActivePort file: ${portFile}`);
  }
  return `ws://${host}:${lines[0]}${lines[1]}`;
}

export function wsUrlToPortFileContent(browserWsUrl) {
  let parsed;
  try {
    parsed = new URL(browserWsUrl);
  } catch {
    throw new Error(`Invalid browser websocket URL: ${browserWsUrl}`);
  }
  if (!['ws:', 'wss:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported browser websocket protocol: ${parsed.protocol}`);
  }
  if (!parsed.port) {
    throw new Error(`Browser websocket URL does not include a port: ${browserWsUrl}`);
  }
  if (!parsed.pathname || parsed.pathname === '/') {
    throw new Error(`Browser websocket URL does not include a debugger path: ${browserWsUrl}`);
  }
  return `${parsed.port}\n${parsed.pathname}${parsed.search}\n`;
}

export async function fetchBrowserWsUrl({
  debugPort = DEFAULT_CDP_DEBUG_PORT,
  fetchImpl = fetch,
  host = DEFAULT_CDP_HOST,
} = {}) {
  const endpoint = `http://${host}:${debugPort}/json/version`;
  const response = await fetchImpl(endpoint);
  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    throw new Error(`Failed to fetch ${endpoint}: ${response.status}${statusText}`);
  }
  const payload = await response.json();
  const browserWsUrl = payload?.webSocketDebuggerUrl;
  if (typeof browserWsUrl !== 'string' || browserWsUrl.trim().length === 0) {
    throw new Error(`No webSocketDebuggerUrl returned from ${endpoint}`);
  }
  return browserWsUrl;
}

export async function resolveChromeWsUrl({
  candidates,
  debugPort = DEFAULT_CDP_DEBUG_PORT,
  existsImpl = existsSync,
  fallbackPortFile,
  fetchImpl = fetch,
  host = DEFAULT_CDP_HOST,
  readFileImpl = readFileSync,
  writeFileImpl = writeFileSync,
}) {
  const portFile = candidates.find((candidate) => candidate && existsImpl(candidate));
  if (portFile) {
    return parseDevToolsPortFile(readFileImpl(portFile, 'utf8'), portFile, host);
  }
  try {
    const browserWsUrl = await fetchBrowserWsUrl({ debugPort, fetchImpl, host });
    writeFileImpl(fallbackPortFile, wsUrlToPortFileContent(browserWsUrl), 'utf8');
    return parseDevToolsPortFile(
      readFileImpl(fallbackPortFile, 'utf8'),
      fallbackPortFile,
      host,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No DevToolsActivePort found and failed to resolve Chrome websocket via http://${host}:${debugPort}/json/version: ${detail}`,
    );
  }
}
