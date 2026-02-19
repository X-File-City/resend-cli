import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockGet = mock(async () => ({
  data: {
    object: 'broadcast' as const,
    id: 'bcast_abc123',
    name: 'Weekly Newsletter',
    segment_id: 'seg_123',
    audience_id: null,
    from: 'hello@domain.com',
    subject: 'This week in Resend',
    reply_to: null,
    preview_text: 'Read what is new',
    html: '<p>Hi</p>',
    text: null,
    status: 'sent' as const,
    created_at: '2026-02-18T12:00:00.000Z',
    scheduled_at: null,
    sent_at: '2026-02-18T12:05:00.000Z',
    topic_id: null,
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { get: mockGet };
  },
}));

describe('broadcasts get command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
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

  test('fetches broadcast by id', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { getBroadcastCommand } = await import('../../../src/commands/broadcasts/get');
    await getBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('bcast_abc123');
  });

  test('outputs full JSON when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { getBroadcastCommand } = await import('../../../src/commands/broadcasts/get');
    await getBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('bcast_abc123');
    expect(parsed.status).toBe('sent');
    expect(parsed.subject).toBe('This week in Resend');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getBroadcastCommand } = await import('../../../src/commands/broadcasts/get');
    try {
      await getBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce({ data: null, error: { message: 'Not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getBroadcastCommand } = await import('../../../src/commands/broadcasts/get');
    try {
      await getBroadcastCommand.parseAsync(['bcast_bad'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
