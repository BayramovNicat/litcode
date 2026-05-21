import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const dist = join(root, 'dist');
const esbuildBin = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild',
);

function compressedSizes(buffer) {
  return {
    raw: buffer.length,
    gzip: zlib.gzipSync(buffer, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buffer, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
  };
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(2)} KB`;
}

function addSizes(left, right) {
  return {
    raw: left.raw + right.raw,
    gzip: left.gzip + right.gzip,
    brotli: left.brotli + right.brotli,
  };
}

function measureFiles(files) {
  let total = { raw: 0, gzip: 0, brotli: 0 };

  for (const file of files) {
    total = addSizes(total, compressedSizes(readFileSync(file)));
  }

  return total;
}

function bundleEntry(source, outfile) {
  const entry = join(dirname(outfile), 'entry.js');
  writeFileSync(entry, source);
  execFileSync(
    esbuildBin,
    [entry, '--bundle', '--minify', '--format=esm', '--platform=browser', `--outfile=${outfile}`],
    { cwd: root, stdio: 'pipe' },
  );
  return compressedSizes(readFileSync(outfile));
}

function printRow(label, sizes) {
  console.log(
    `${label.padEnd(34)} raw ${formatBytes(sizes.raw).padStart(9)}  gzip ${formatBytes(sizes.gzip).padStart(9)}  brotli ${formatBytes(sizes.brotli).padStart(9)}`,
  );
}

const distFiles = readdirSync(dist)
  .filter((file) => file.endsWith('.js'))
  .map((file) => join(dist, file));

const coreFiles = distFiles.filter((file) => /^core.*\.js$/.test(basename(file)));
const rootFiles = distFiles.filter((file) => /^(index|variants|core.*)\.js$/.test(basename(file)));
const tempDir = mkdtempSync(join(tmpdir(), 'litcode-size-'));

try {
  const coreImport = resolve(dist, 'core.js');
  const rootImport = resolve(dist, 'index.js');

  const bundledCore = bundleEntry(
    `import { html, mount } from ${JSON.stringify(coreImport)};\nconsole.log(html, mount);\n`,
    join(tempDir, 'core-bundle.js'),
  );
  const bundledRoot = bundleEntry(
    `import * as Litcode from ${JSON.stringify(rootImport)};\nconsole.log(Litcode);\n`,
    join(tempDir, 'root-bundle.js'),
  );

  console.log('Litcode size report');
  printRow('dist core runtime files', measureFiles(coreFiles));
  printRow('dist root runtime graph', measureFiles(rootFiles));
  printRow('bundled core import', bundledCore);
  printRow('bundled root import', bundledRoot);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
