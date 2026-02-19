import { describe, test, expect, spyOn, afterEach } from 'bun:test';
import { ExitError, mockExitThrow } from '../helpers';

describe('promptForMissing', () => {
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
  });

  test('returns options unchanged when nothing is missing', async () => {
    const { promptForMissing } = require('../../src/lib/prompts');
    const opts = { from: 'a@b.com', to: 'c@d.com', subject: 'Hi' };
    const result = await promptForMissing(opts, [
      { flag: 'from', message: 'From' },
      { flag: 'to', message: 'To' },
      { flag: 'subject', message: 'Subject' },
    ]);
    expect(result).toEqual(opts);
  });

  test('exits with error listing missing flags in non-interactive mode', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new ExitError(code ?? 0);
    });

    const { promptForMissing } = require('../../src/lib/prompts');

    try {
      await promptForMissing(
        { from: undefined, to: 'c@d.com', subject: undefined },
        [
          { flag: 'from', message: 'From' },
          { flag: 'to', message: 'To' },
          { flag: 'subject', message: 'Subject' },
        ]
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const allErrors = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(allErrors).toContain('--from');
    expect(allErrors).toContain('--subject');
    // --to should NOT be listed since it has a value
    expect(allErrors).not.toContain('--to,');
  });

  test('skips fields marked as required=false', async () => {
    const { promptForMissing } = require('../../src/lib/prompts');
    const opts = { from: 'a@b.com', to: undefined };
    const result = await promptForMissing(opts, [
      { flag: 'from', message: 'From' },
      { flag: 'to', message: 'To', required: false },
    ]);
    expect(result).toEqual(opts);
  });
});

describe('confirmDelete', () => {
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
  });

  test('exits with confirmation_required when non-interactive', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { confirmDelete } = require('../../src/lib/prompts');
    try {
      await confirmDelete('res_123', 'Delete resource res_123?', { json: false });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  test('outputs JSON confirmation_required error when json option is true', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { confirmDelete } = require('../../src/lib/prompts');
    try {
      await confirmDelete('res_123', 'Delete?', { json: true });
    } catch { /* expected exit */ }

    const raw = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    const parsed = JSON.parse(raw);
    expect(parsed.error.code).toBe('confirmation_required');
  });
});
