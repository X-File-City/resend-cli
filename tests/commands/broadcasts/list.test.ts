import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockList = mock(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      { id: 'bcast_abc123', name: 'Weekly Newsletter', segment_id: 'seg_123', audience_id: null, status: 'sent' as const, created_at: '2026-02-18T12:00:00.000Z', scheduled_at: null, sent_at: null },
    ],
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { list: mockList };
  },
}));

describe('broadcasts list command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
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

  test('lists broadcasts', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    await listBroadcastsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
  });

  test('outputs JSON list when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    await listBroadcastsCommand.parseAsync([], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].id).toBe('bcast_abc123');
  });

  test('passes --limit to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    await listBroadcastsCommand.parseAsync(['--limit', '5'], { from: 'user' });

    const opts = mockList.mock.calls[0][0] as any;
    expect(opts.limit).toBe(5);
  });

  test('passes --after cursor to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    await listBroadcastsCommand.parseAsync(['--after', 'bcast_cursor'], { from: 'user' });

    const opts = mockList.mock.calls[0][0] as any;
    expect(opts.after).toBe('bcast_cursor');
  });

  test('passes --before cursor to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    await listBroadcastsCommand.parseAsync(['--before', 'bcast_cursor'], { from: 'user' });

    const opts = mockList.mock.calls[0][0] as any;
    expect(opts.before).toBe('bcast_cursor');
  });

  test('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    try {
      await listBroadcastsCommand.parseAsync(['--limit', '999'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    try {
      await listBroadcastsCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce({ data: null, error: { message: 'Internal server error', name: 'server_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listBroadcastsCommand } = await import('../../../src/commands/broadcasts/list');
    try {
      await listBroadcastsCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
