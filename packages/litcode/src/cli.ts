#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type AgentTarget = 'cursor' | 'codex' | 'claude' | 'copilot' | 'antigravity';

export type InstallStatus = 'created' | 'updated' | 'unchanged' | 'skipped';

export type InstallResult = {
  target: AgentTarget;
  path: string;
  absolutePath: string;
  status: InstallStatus;
};

export type InstallAgentFilesOptions = {
  cwd: string;
  targets?: readonly AgentTarget[];
  force?: boolean;
  dryRun?: boolean;
  template?: string;
};

type AgentFileSpec = {
  path: string;
  render: (body: string) => string;
};

type ParsedArguments = {
  command: 'help' | 'init' | 'version';
  cwd: string;
  dryRun: boolean;
  force: boolean;
  help: boolean;
  list: boolean;
  targetInputs: string[];
};

type CliIo = {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

const agentTargets = ['cursor', 'codex', 'claude', 'copilot', 'antigravity'] as const;

const agentFileSpecs: Record<AgentTarget, AgentFileSpec> = {
  cursor: {
    path: '.cursor/rules/frontend-code-style.mdc',
    render: (body) => `---
description: Frontend code style for the Litcode TypeScript DOM primitives project.
globs: 'packages/litcode/src/**/*.ts, packages/litcode/tests/**/*.ts, packages/litcode/benchmarks/**/*.ts, apps/examples/src/**/*.ts, apps/examples/src/**/*.css, apps/examples/*.html'
alwaysApply: false
---

${body}`,
  },
  codex: {
    path: 'AGENTS.md',
    render: (body) => body,
  },
  claude: {
    path: 'CLAUDE.md',
    render: (body) => body,
  },
  copilot: {
    path: '.github/copilot-instructions.md',
    render: (body) => body,
  },
  antigravity: {
    path: '.agents/rules/frontend-code-style.md',
    render: (body) => body,
  },
};

const targetAliases: Record<string, AgentTarget | 'all'> = {
  all: 'all',
  antigravity: 'antigravity',
  anthropic: 'claude',
  claude: 'claude',
  'claude-code': 'claude',
  codex: 'codex',
  copilot: 'copilot',
  cursor: 'cursor',
  github: 'copilot',
  'github-copilot': 'copilot',
  'google-antigravity': 'antigravity',
};

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export async function installAgentFiles(
  options: InstallAgentFilesOptions,
): Promise<InstallResult[]> {
  const cwd = resolve(options.cwd);
  const body = normalizeTemplate(options.template ?? (await loadAgentTemplate()));
  const targets = options.targets?.length ? [...options.targets] : [...agentTargets];
  const results: InstallResult[] = [];

  for (const target of targets) {
    const spec = agentFileSpecs[target];
    const absolutePath = resolve(cwd, spec.path);
    const content = normalizeTemplate(spec.render(body));
    const existing = await readIfExists(absolutePath);
    let status: InstallStatus;

    if (existing === content) {
      status = 'unchanged';
    } else if (existing !== undefined && !options.force) {
      status = 'skipped';
    } else {
      status = existing === undefined ? 'created' : 'updated';

      if (!options.dryRun) {
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, content, 'utf8');
      }
    }

    results.push({
      target,
      path: spec.path,
      absolutePath,
      status,
    });
  }

  return results;
}

export async function runCli(argv = process.argv.slice(2), io: CliIo = {}): Promise<number> {
  const stdout = io.stdout ?? ((message: string) => console.log(message));
  const stderr = io.stderr ?? ((message: string) => console.error(message));

  try {
    const parsed = parseArguments(argv);

    if (parsed.help || parsed.command === 'help') {
      stdout(helpText());
      return 0;
    }

    if (parsed.command === 'version') {
      stdout(await readPackageVersion());
      return 0;
    }

    if (parsed.list) {
      stdout(targetListText());
      return 0;
    }

    const targets = normalizeTargets(parsed.targetInputs);
    const results = await installAgentFiles({
      cwd: parsed.cwd,
      targets,
      force: parsed.force,
      dryRun: parsed.dryRun,
    });

    stdout(formatResults(results, resolve(parsed.cwd), parsed.dryRun));
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      stderr(error.message);
      stderr('Run `litcode init --help` for usage.');
      return 1;
    }

    throw error;
  }
}

function parseArguments(argv: string[]): ParsedArguments {
  const parsed: ParsedArguments = {
    command: 'help',
    cwd: process.cwd(),
    dryRun: false,
    force: false,
    help: false,
    list: false,
    targetInputs: [],
  };

  const args = [...argv];
  const first = args[0];

  if (first === undefined || first === 'help') {
    return parsed;
  }

  if (first === '--help' || first === '-h') {
    parsed.help = true;
    return parsed;
  }

  if (first === '--version' || first === '-v' || first === 'version') {
    parsed.command = 'version';
    return parsed;
  }

  if (first === '--list') {
    parsed.command = 'init';
    parsed.list = true;
    args.shift();
  } else if (first === 'init' || first === 'agents' || first === 'scripts') {
    parsed.command = 'init';
    args.shift();
  } else if (isTargetInput(first)) {
    parsed.command = 'init';
  } else {
    throw new CliError(`Unknown command: ${first}`);
  }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--force' || arg === '-f') {
      parsed.force = true;
      continue;
    }

    if (arg === '--dry-run' || arg === '-n') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--all') {
      parsed.targetInputs.push('all');
      continue;
    }

    if (arg === '--list') {
      parsed.list = true;
      continue;
    }

    if (arg === '--cwd') {
      const value = args[++index];
      assertOptionValue(arg, value);
      parsed.cwd = value;
      continue;
    }

    if (arg.startsWith('--cwd=')) {
      parsed.cwd = readEqualsValue(arg);
      continue;
    }

    if (isTargetOption(arg)) {
      const value = args[++index];
      assertOptionValue(arg, value);
      parsed.targetInputs.push(value);
      continue;
    }

    const targetOption = readTargetOptionWithEquals(arg);

    if (targetOption !== undefined) {
      parsed.targetInputs.push(targetOption);
      continue;
    }

    if (arg.startsWith('-')) {
      throw new CliError(`Unknown option: ${arg}`);
    }

    parsed.targetInputs.push(arg);
  }

  return parsed;
}

function isTargetOption(arg: string): boolean {
  return (
    arg === '--target' ||
    arg === '--targets' ||
    arg === '--tool' ||
    arg === '--tools' ||
    arg === '--agent' ||
    arg === '--agents'
  );
}

function readTargetOptionWithEquals(arg: string): string | undefined {
  const option = ['--target=', '--targets=', '--tool=', '--tools=', '--agent=', '--agents='].find(
    (prefix) => arg.startsWith(prefix),
  );

  if (option === undefined) {
    return undefined;
  }

  return readEqualsValue(arg);
}

function assertOptionValue(option: string, value: string | undefined): asserts value is string {
  if (value === undefined || value.startsWith('-')) {
    throw new CliError(`Missing value for ${option}`);
  }
}

function readEqualsValue(arg: string): string {
  const index = arg.indexOf('=');
  const value = arg.slice(index + 1);

  if (!value) {
    throw new CliError(`Missing value for ${arg.slice(0, index)}`);
  }

  return value;
}

function normalizeTargets(inputs: readonly string[]): AgentTarget[] {
  const values = inputs
    .flatMap((input) => input.split(','))
    .map((input) => input.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    return [...agentTargets];
  }

  const targets: AgentTarget[] = [];

  for (const value of values) {
    const target = targetAliases[value];

    if (target === undefined) {
      throw new CliError(`Unknown agent target: ${value}`);
    }

    if (target === 'all') {
      return [...agentTargets];
    }

    if (!targets.includes(target)) {
      targets.push(target);
    }
  }

  return targets;
}

function isTargetInput(input: string): boolean {
  return input
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .every((value) => targetAliases[value] !== undefined);
}

async function loadAgentTemplate(): Promise<string> {
  const templatePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../templates/agents/frontend-code-style.md',
  );

  return readFile(templatePath, 'utf8');
}

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return undefined;
    }

    throw error;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

function normalizeTemplate(value: string): string {
  return `${value.trimEnd()}\n`;
}

function formatResults(results: readonly InstallResult[], cwd: string, dryRun: boolean): string {
  const lines = [`${dryRun ? 'Would write' : 'Litcode agent files'} in ${cwd}:`, ''];

  for (const result of results) {
    lines.push(`${statusMarker(result.status)} ${result.target.padEnd(11)} ${result.path}`);
  }

  if (results.some((result) => result.status === 'skipped')) {
    lines.push('', 'Skipped files already exist. Re-run with --force to replace them.');
  }

  return lines.join('\n');
}

function statusMarker(status: InstallStatus): string {
  switch (status) {
    case 'created':
      return '+ created  ';
    case 'updated':
      return '~ updated  ';
    case 'unchanged':
      return '= same     ';
    case 'skipped':
      return '! skipped  ';
  }
}

async function readPackageVersion(): Promise<string> {
  const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: string;
  };

  return packageJson.version ?? 'unknown';
}

function targetListText(): string {
  return agentTargets
    .map((target) => `${target.padEnd(11)} ${agentFileSpecs[target].path}`)
    .join('\n');
}

function helpText(): string {
  return `Litcode agent file initializer

Usage:
  litcode init [targets] [options]
  litcode agents [targets] [options]
  litcode scripts [targets] [options]

Targets:
  cursor        .cursor/rules/frontend-code-style.mdc
  codex         AGENTS.md
  claude        CLAUDE.md
  copilot       .github/copilot-instructions.md
  antigravity   .agents/rules/frontend-code-style.md
  all           write every target (default)

Options:
  --target, --targets <list>   Comma-separated target list
  --tool, --tools <list>       Alias for --targets
  --agent, --agents <list>     Alias for --targets
  --cwd <path>                 Project directory to initialize
  --force, -f                  Replace existing files
  --dry-run, -n                Preview changes
  --list                       Show target output paths
  --version, -v                Show package version
  --help, -h                   Show this help

Examples:
  bunx @holmityd/litcode init
  bunx @holmityd/litcode agents cursor,codex,claude
  bunx @holmityd/litcode init --tools copilot,antigravity --cwd ../my-app
`;
}

function isMainModule(): boolean {
  const entry = process.argv[1];

  if (entry === undefined) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
