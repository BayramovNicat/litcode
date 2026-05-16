import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

type BenchResult = {
  name: string;
  samples: number[];
};

const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const timeoutMs = 180_000;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function print(result: BenchResult): void {
  const avg = mean(result.samples);
  const med = median(result.samples);
  const min = Math.min(...result.samples);
  const max = Math.max(...result.samples);

  console.log(
    `${result.name.padEnd(32)} avg ${avg.toFixed(4)}ms  med ${med.toFixed(4)}ms  min ${min.toFixed(4)}ms  max ${max.toFixed(4)}ms`,
  );
}

function waitForDevtoolsUrl(chrome: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Chrome DevTools URL')), 15_000);

    chrome.stderr?.on('data', (chunk) => {
      const output = String(chunk);
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);

      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
}

async function waitForPageWebSocket(devtoolsUrl: string, pageUrl: string): Promise<string> {
  const devtools = new URL(devtoolsUrl);
  const origin = `http://${devtools.host}`;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const pages = (await fetch(`${origin}/json/list`).then((response) => response.json())) as Array<{
      url: string;
      webSocketDebuggerUrl?: string;
    }>;
    const page = pages.find((entry) => entry.url === pageUrl && entry.webSocketDebuggerUrl);

    if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timed out waiting for benchmark page');
}

function evaluate<T>(socket: WebSocket, expression: string): Promise<T> {
  const id = evaluate.nextId++;

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== id) return;

      socket.removeEventListener('message', onMessage);

      if (message.error) {
        reject(new Error(message.error.message));
        return;
      }

      resolve(message.result.result.value as T);
    };

    socket.addEventListener('message', onMessage);
    socket.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          expression,
          returnByValue: true,
        },
      }),
    );
  });
}
evaluate.nextId = 1;

async function waitForResults(socket: WebSocket): Promise<BenchResult[]> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const done = await evaluate<boolean>(socket, 'window.__litcodeBenchDone === true');

    if (done) {
      return evaluate<BenchResult[]>(socket, 'window.__litcodeBenchResults');
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for browser benchmark results');
}

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: 0,
  },
  logLevel: 'error',
});

await server.listen();

const address = server.httpServer?.address();
const port = typeof address === 'object' && address ? address.port : 5173;
const url = `http://127.0.0.1:${port}/benchmarks/browser.bench.html`;
const userDataDir = await mkdtemp(join(tmpdir(), 'litcode-browser-bench-'));
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    url,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

let socket: WebSocket | undefined;

try {
  const devtoolsUrl = await waitForDevtoolsUrl(chrome);
  const pageWebSocket = await waitForPageWebSocket(devtoolsUrl, url);
  socket = new WebSocket(pageWebSocket);

  await new Promise<void>((resolve, reject) => {
    socket?.addEventListener('open', () => resolve(), { once: true });
    socket?.addEventListener('error', () => reject(new Error('Failed to connect to benchmark page')), {
      once: true,
    });
  });

  const results = await waitForResults(socket);

  console.log(`DOM browser benchmarks (${results[0]?.samples.length ?? 0} samples, ms/update)`);
  for (const result of results) print(result);
} finally {
  socket?.close();
  chrome.kill();
  await server.close();
  setTimeout(() => void rm(userDataDir, { recursive: true, force: true }), 1_000).unref();
}
