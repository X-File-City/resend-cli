import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import { captureTestEnv, setupOutputSpies, mockExitThrow, expectExit1 } from '../../helpers';

const mockWriteFileSync = mock(() => {});
const mockMkdirSync = mock(() => {});
const mockReadFileSync = mock(() => JSON.stringify({ preferences: { menuBarEnabled: false } }));
const mockExistsSync = mock(() => true);
const mockReaddirSync = mock(() => []);
const mockLstatSync = mock(() => ({ isDirectory: () => false }));

mock.module('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync,
  lstatSync: mockLstatSync,
  unlinkSync: mock(() => {}),
  chmodSync: mock(() => {}),
}));

describe('setupClaudeDesktop', () => {
  const restoreEnv = captureTestEnv();
  afterEach(() => {
    restoreEnv();
    mockWriteFileSync.mockClear();
    mockReadFileSync.mockClear();
    mockExistsSync.mockClear();
    mockMkdirSync.mockClear();
  });

  test('merges resend into mcpServers preserving existing top-level keys', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupClaudeDesktop } = await import('../../../src/commands/setup/claude-desktop');
      await setupClaudeDesktop({ json: true });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.preferences).toBeDefined();
      expect(written.mcpServers.resend.command).toBe('npx');
      expect(written.mcpServers.resend.args).toEqual(['-y', 'resend-mcp']);
      expect(typeof written.mcpServers.resend.env.RESEND_API_KEY).toBe('string');
    } finally {
      restore();
    }
  });

  test('outputs JSON with configured:true and tool:claude-desktop', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupClaudeDesktop } = await import('../../../src/commands/setup/claude-desktop');
      await setupClaudeDesktop({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('claude-desktop');
      expect(output.config_path).toBeDefined();
    } finally {
      restore();
    }
  });

  test('calls outputError with config_write_error on failure', async () => {
    mockWriteFileSync.mockImplementationOnce(() => { throw new Error('No space'); });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupClaudeDesktop } = await import('../../../src/commands/setup/claude-desktop');
      await expectExit1(() => setupClaudeDesktop({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('config_write_error');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
