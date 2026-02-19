import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockUpdate = mock(async () => ({
  data: { id: 'bcast_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { update: mockUpdate };
  },
}));

describe('broadcasts update command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
  });

  test('updates broadcast subject', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
    await updateBroadcastCommand.parseAsync(['bcast_abc123', '--subject', 'Updated Subject'], { from: 'user' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe('bcast_abc123');
    const payload = mockUpdate.mock.calls[0][1] as any;
    expect(payload.subject).toBe('Updated Subject');
  });

  test('passes all update flags to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
    await updateBroadcastCommand.parseAsync(
      ['bcast_abc123', '--from', 'new@domain.com', '--subject', 'New Subject', '--text', 'New body', '--name', 'New Label'],
      { from: 'user' }
    );

    const payload = mockUpdate.mock.calls[0][1] as any;
    expect(payload.from).toBe('new@domain.com');
    expect(payload.subject).toBe('New Subject');
    expect(payload.text).toBe('New body');
    expect(payload.name).toBe('New Label');
  });

  test('outputs JSON id when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
    await updateBroadcastCommand.parseAsync(['bcast_abc123', '--subject', 'Updated'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('bcast_abc123');
  });

  test('omits undefined fields from SDK payload', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
    await updateBroadcastCommand.parseAsync(['bcast_abc123', '--name', 'Only Name'], { from: 'user' });

    const payload = mockUpdate.mock.calls[0][1] as any;
    expect(payload.name).toBe('Only Name');
    expect(payload.from).toBeUndefined();
    expect(payload.subject).toBeUndefined();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
    try {
      await updateBroadcastCommand.parseAsync(['bcast_abc123', '--subject', 'X'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce({ data: null, error: { message: 'Cannot update sent broadcast', name: 'validation_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
    try {
      await updateBroadcastCommand.parseAsync(['bcast_sent', '--subject', 'New'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });

  test('reads html body from --html-file and passes it to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const tmpFile = join(import.meta.dir, 'tmp-update-broadcast.html');
    writeFileSync(tmpFile, '<p>Updated from file</p>', 'utf-8');
    try {
      const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
      await updateBroadcastCommand.parseAsync(
        ['bcast_abc123', '--html-file', tmpFile],
        { from: 'user' }
      );

      const payload = mockUpdate.mock.calls[0][1] as any;
      expect(payload.html).toBe('<p>Updated from file</p>');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  test('errors with file_read_error when --html-file path is unreadable', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import('../../../src/commands/broadcasts/update');
    try {
      await updateBroadcastCommand.parseAsync(
        ['bcast_abc123', '--html-file', '/nonexistent/file.html'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });
});
