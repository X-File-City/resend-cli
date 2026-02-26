import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import { captureTestEnv, setNonInteractive, mockExitThrow, expectExit1 } from '../../helpers';

// Provide a complete node:fs mock so @clack/prompts (which imports readdirSync
// and lstatSync) does not fail when this file runs after another test file that
// only partially mocked node:fs.
mock.module('node:fs', () => ({
  existsSync: mock(() => false),
  readFileSync: mock(() => '{}'),
  writeFileSync: mock(() => {}),
  mkdirSync: mock(() => {}),
  readdirSync: mock(() => []),
  lstatSync: mock(() => ({ isDirectory: () => false })),
  unlinkSync: mock(() => {}),
  chmodSync: mock(() => {}),
}));

// No mock.module for subcommand modules — the real source files are used.
// The tests here only exercise the parent command's non-interactive guard and
// subcommand registration; no subcommand action function is invoked.

describe('setup index — non-interactive guard', () => {
  const restoreEnv = captureTestEnv();
  afterEach(() => restoreEnv());

  test('errors with missing_target when run non-interactively without a subcommand', async () => {
    setNonInteractive();
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupCommand } = await import('../../../src/commands/setup/index');
      await expectExit1(() => setupCommand.parseAsync([], { from: 'user' }));

      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('missing_target');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  test('all five subcommands are registered on setupCommand', async () => {
    const { setupCommand } = await import('../../../src/commands/setup/index');
    const names = setupCommand.commands.map((c) => c.name());
    expect(names).toContain('cursor');
    expect(names).toContain('claude-desktop');
    expect(names).toContain('claude-code');
    expect(names).toContain('vscode');
    expect(names).toContain('openclaw');
  });
});
