import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { installAgentFiles, runCli } from '../src/cli.ts';

async function withTempProject<T>(callback: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(join(tmpdir(), 'litcode-agents-'));

  try {
    return await callback(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

describe('litcode agent CLI', () => {
  it('writes every supported agent file by default', async () => {
    await withTempProject(async (cwd) => {
      const results = await installAgentFiles({ cwd });

      assert.deepEqual(
        results.map((result) => result.status),
        ['created', 'created', 'created', 'created', 'created'],
      );

      const cursorRule = await readFile(join(cwd, '.cursor/rules/frontend-code-style.mdc'), 'utf8');
      const codexRule = await readFile(join(cwd, 'AGENTS.md'), 'utf8');
      const claudeRule = await readFile(join(cwd, 'CLAUDE.md'), 'utf8');
      const copilotRule = await readFile(join(cwd, '.github/copilot-instructions.md'), 'utf8');
      const antigravityRule = await readFile(
        join(cwd, '.agents/rules/frontend-code-style.md'),
        'utf8',
      );

      assert.match(cursorRule, /^---\ndescription:/);
      assert.match(codexRule, /# Frontend Code Style/);
      assert.equal(codexRule, claudeRule);
      assert.equal(codexRule, copilotRule);
      assert.equal(codexRule, antigravityRule);
    });
  });

  it('skips existing files unless force is enabled', async () => {
    await withTempProject(async (cwd) => {
      const codexPath = join(cwd, 'AGENTS.md');
      await writeFile(codexPath, 'custom\n', 'utf8');

      const skipped = await installAgentFiles({ cwd, targets: ['codex'] });
      assert.equal(skipped[0]?.status, 'skipped');
      assert.equal(await readFile(codexPath, 'utf8'), 'custom\n');

      const updated = await installAgentFiles({
        cwd,
        targets: ['codex'],
        force: true,
      });
      assert.equal(updated[0]?.status, 'updated');
      assert.match(await readFile(codexPath, 'utf8'), /# Frontend Code Style/);
    });
  });

  it('accepts init aliases and comma-separated targets', async () => {
    await withTempProject(async (cwd) => {
      const output: string[] = [];
      const code = await runCli(
        ['agents', '--cwd', cwd, '--targets', 'codex,claude-code,copilot'],
        {
          stdout: (message) => output.push(message),
        },
      );

      assert.equal(code, 0);
      assert.match(output.join('\n'), /codex/);
      assert.match(output.join('\n'), /claude/);
      assert.match(output.join('\n'), /copilot/);
      assert.match(await readFile(join(cwd, 'AGENTS.md'), 'utf8'), /# Frontend Code Style/);
      assert.match(await readFile(join(cwd, 'CLAUDE.md'), 'utf8'), /# Frontend Code Style/);
      assert.match(
        await readFile(join(cwd, '.github/copilot-instructions.md'), 'utf8'),
        /# Frontend Code Style/,
      );
    });
  });

  it('prints the package version', async () => {
    const output: string[] = [];
    const code = await runCli(['--version'], {
      stdout: (message) => output.push(message),
    });

    assert.equal(code, 0);
    assert.match(output[0] ?? '', /^\d+\.\d+\.\d+/);
  });

  it('lists supported agent targets', async () => {
    const output: string[] = [];
    const code = await runCli(['--list'], {
      stdout: (message) => output.push(message),
    });

    assert.equal(code, 0);
    assert.match(output.join('\n'), /claude\s+CLAUDE\.md/);
  });
});
