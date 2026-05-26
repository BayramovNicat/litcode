import { chmodSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

if (existsSync(cliPath)) {
  chmodSync(cliPath, 0o755);
}
