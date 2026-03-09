import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

describe('logout command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
    spies = undefined;
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeCredentials(key = 're_test_key_123') {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      `${JSON.stringify({ api_key: key })}\n`,
    );
  }

  test('removes credentials file when it exists (non-interactive)', async () => {
    spies = setupOutputSpies();
    writeCredentials();

    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    await logoutCommand.parseAsync([], { from: 'user' });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.config_path).toContain('credentials.json');
  });

  test('exits cleanly when no credentials file exists (non-interactive)', async () => {
    spies = setupOutputSpies();

    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    await logoutCommand.parseAsync([], { from: 'user' });

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.already_logged_out).toBe(true);
  });

  test('exits with error when file removal fails', async () => {
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    spies = setupOutputSpies();
    writeCredentials();

    // Make the credentials file a directory so unlinkSync throws
    const configPath = join(tmpDir, 'resend', 'credentials.json');
    rmSync(configPath);
    mkdirSync(configPath); // replace file with a directory — unlinkSync will throw EISDIR

    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    await expectExit1(() => logoutCommand.parseAsync([], { from: 'user' }));

    const output = JSON.parse(errorSpy!.mock.calls[0][0] as string);
    expect(output.error.code).toBe('remove_failed');
  });
});
