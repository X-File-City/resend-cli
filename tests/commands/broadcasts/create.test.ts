import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockCreate = mock(async () => ({
  data: { id: 'bcast_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { create: mockCreate };
  },
}));

describe('broadcasts create command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
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

  test('creates broadcast with required flags', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    await createBroadcastCommand.parseAsync(
      ['--from', 'hello@domain.com', '--subject', 'Weekly Update', '--segment-id', 'seg_123', '--html', '<p>Hi</p>'],
      { from: 'user' }
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.from).toBe('hello@domain.com');
    expect(args.subject).toBe('Weekly Update');
    expect(args.segmentId).toBe('seg_123');
    expect(args.html).toBe('<p>Hi</p>');
  });

  test('outputs JSON id when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    await createBroadcastCommand.parseAsync(
      ['--from', 'hello@domain.com', '--subject', 'News', '--segment-id', 'seg_123', '--text', 'Hello!'],
      { from: 'user' }
    );

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('bcast_abc123');
  });

  test('passes --send flag to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    await createBroadcastCommand.parseAsync(
      ['--from', 'hello@domain.com', '--subject', 'Go', '--segment-id', 'seg_123', '--text', 'Hi', '--send'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.send).toBe(true);
  });

  test('passes --scheduled-at with --send to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    await createBroadcastCommand.parseAsync(
      ['--from', 'hello@domain.com', '--subject', 'Go', '--segment-id', 'seg_123', '--text', 'Hi', '--send', '--scheduled-at', 'in 1 hour'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.scheduledAt).toBe('in 1 hour');
  });

  test('passes optional flags to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    await createBroadcastCommand.parseAsync(
      [
        '--from', 'hello@domain.com',
        '--subject', 'News',
        '--segment-id', 'seg_123',
        '--html', '<p>Hi</p>',
        '--name', 'Q1 Newsletter',
        '--reply-to', 'reply@domain.com',
        '--preview-text', 'Read the news',
        '--topic-id', 'topic_xyz',
      ],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.name).toBe('Q1 Newsletter');
    expect(args.replyTo).toBe('reply@domain.com');
    expect(args.previewText).toBe('Read the news');
    expect(args.topicId).toBe('topic_xyz');
  });

  test('errors with missing_from when --from absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync(
        ['--subject', 'News', '--segment-id', 'seg_123', '--html', '<p>Hi</p>'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_from');
  });

  test('errors with missing_subject when --subject absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync(
        ['--from', 'hello@domain.com', '--segment-id', 'seg_123', '--html', '<p>Hi</p>'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_subject');
  });

  test('errors with missing_segment when --segment-id absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync(
        ['--from', 'hello@domain.com', '--subject', 'News', '--html', '<p>Hi</p>'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_segment');
  });

  test('errors with missing_body when no body flag in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync(
        ['--from', 'hello@domain.com', '--subject', 'News', '--segment-id', 'seg_123'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_body');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync(
        ['--from', 'hello@domain.com', '--subject', 'News', '--segment-id', 'seg_123', '--html', '<p>Hi</p>'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce({ data: null, error: { message: 'Segment not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync(
        ['--from', 'hello@domain.com', '--subject', 'News', '--segment-id', 'seg_bad', '--html', '<p>Hi</p>'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });

  test('does not call SDK when validation fails', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync([], { from: 'user' });
    } catch {
      // expected exit
    }

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('reads html body from --html-file and passes it to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const tmpFile = join(import.meta.dir, 'tmp-broadcast.html');
    writeFileSync(tmpFile, '<p>From file</p>', 'utf-8');
    try {
      const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
      await createBroadcastCommand.parseAsync(
        ['--from', 'hello@domain.com', '--subject', 'News', '--segment-id', 'seg_123', '--html-file', tmpFile],
        { from: 'user' }
      );

      const args = mockCreate.mock.calls[0][0] as any;
      expect(args.html).toBe('<p>From file</p>');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  test('errors with file_read_error when --html-file path is unreadable', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import('../../../src/commands/broadcasts/create');
    try {
      await createBroadcastCommand.parseAsync(
        ['--from', 'hello@domain.com', '--subject', 'News', '--segment-id', 'seg_123', '--html-file', '/nonexistent/file.html'],
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
