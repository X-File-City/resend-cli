import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockList = mock(async () => ({
  data: {
    object: 'list',
    data: [
      { id: 'domain-1', name: 'example.com', status: 'verified', region: 'us-east-1', created_at: '2026-01-01T00:00:00.000Z', capabilities: { sending: 'enabled', receiving: 'disabled' } },
      { id: 'domain-2', name: 'test.com', status: 'pending', region: 'eu-west-1', created_at: '2026-01-02T00:00:00.000Z', capabilities: { sending: 'enabled', receiving: 'disabled' } },
    ],
    has_more: false,
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { list: mockList };
  },
}));

describe('domains list command', () => {
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

  test('calls SDK list and outputs domains as JSON', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listDomainsCommand } = await import('../../../src/commands/domains/list');
    await listDomainsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(2);
  });

  test('passes limit to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listDomainsCommand } = await import('../../../src/commands/domains/list');
    await listDomainsCommand.parseAsync(['--limit', '25'], { from: 'user' });

    const callArgs = mockList.mock.calls[0][0] as any;
    expect(callArgs.limit).toBe(25);
  });

  test('passes after cursor to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listDomainsCommand } = await import('../../../src/commands/domains/list');
    await listDomainsCommand.parseAsync(['--after', 'some-cursor'], { from: 'user' });

    const callArgs = mockList.mock.calls[0][0] as any;
    expect(callArgs.after).toBe('some-cursor');
  });

  test('uses default limit of 10 when not specified', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listDomainsCommand } = await import('../../../src/commands/domains/list');
    await listDomainsCommand.parseAsync([], { from: 'user' });

    const callArgs = mockList.mock.calls[0][0] as any;
    expect(callArgs.limit).toBe(10);
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listDomainsCommand } = await import('../../../src/commands/domains/list');
    try {
      await listDomainsCommand.parseAsync([], { from: 'user' });
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
    mockList.mockResolvedValueOnce({ data: null, error: { message: 'Unauthorized', name: 'auth_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listDomainsCommand } = await import('../../../src/commands/domains/list');
    try {
      await listDomainsCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
