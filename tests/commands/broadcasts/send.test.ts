import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockSend = mock(async () => ({
  data: { id: 'bcast_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { send: mockSend };
  },
}));

describe('broadcasts send command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
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

  test('sends broadcast by id', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendBroadcastCommand } = await import('../../../src/commands/broadcasts/send');
    await sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toBe('bcast_abc123');
  });

  test('outputs JSON id when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendBroadcastCommand } = await import('../../../src/commands/broadcasts/send');
    await sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('bcast_abc123');
  });

  test('passes --scheduled-at to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendBroadcastCommand } = await import('../../../src/commands/broadcasts/send');
    await sendBroadcastCommand.parseAsync(['bcast_abc123', '--scheduled-at', 'in 1 hour'], { from: 'user' });

    const payload = mockSend.mock.calls[0][1] as any;
    expect(payload.scheduledAt).toBe('in 1 hour');
  });

  test('does not pass scheduledAt when flag absent', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendBroadcastCommand } = await import('../../../src/commands/broadcasts/send');
    await sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    const payload = mockSend.mock.calls[0][1] as any;
    expect(payload.scheduledAt).toBeUndefined();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendBroadcastCommand } = await import('../../../src/commands/broadcasts/send');
    try {
      await sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with send_error when SDK returns an error', async () => {
    setNonInteractive();
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'Broadcast not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { sendBroadcastCommand } = await import('../../../src/commands/broadcasts/send');
    try {
      await sendBroadcastCommand.parseAsync(['bcast_bad'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('send_error');
  });
});
