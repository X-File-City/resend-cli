import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import { captureTestEnv, setupOutputSpies, mockExitThrow, expectExit1 } from '../../helpers';

const mockWriteFileSync = mock(() => {});
const mockMkdirSync = mock(() => {});
const mockReadFileSync = mock(() => JSON.stringify({ servers: { other: { type: 'stdio', command: 'other', args: [] } } }));
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

describe('setupVscode', () => {
  const restoreEnv = captureTestEnv();
  afterEach(() => {
    restoreEnv();
    mockWriteFileSync.mockClear();
    mockReadFileSync.mockClear();
    mockExistsSync.mockClear();
    mockMkdirSync.mockClear();
  });

  test('uses "servers" key (not "mcpServers") with npx entry', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupVscode } = await import('../../../src/commands/setup/vscode');
      await setupVscode({ json: true });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.servers).toBeDefined();
      expect(written.mcpServers).toBeUndefined();
      expect(written.servers.resend.type).toBeUndefined();
      expect(written.servers.resend.command).toBe('npx');
      expect(written.servers.resend.args).toEqual(['-y', 'resend-mcp']);
      expect(typeof written.servers.resend.env.RESEND_API_KEY).toBe('string');
    } finally {
      restore();
    }
  });

  test('preserves other entries in servers object', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupVscode } = await import('../../../src/commands/setup/vscode');
      await setupVscode({ json: true });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.servers.other).toBeDefined();
    } finally {
      restore();
    }
  });

  test('outputs JSON with config_path containing .vscode/mcp.json', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupVscode } = await import('../../../src/commands/setup/vscode');
      await setupVscode({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('vscode');
      expect(output.config_path).toContain('.vscode/mcp.json');
    } finally {
      restore();
    }
  });

  test('calls outputError with config_write_error on failure', async () => {
    mockWriteFileSync.mockImplementationOnce(() => { throw new Error('EPERM'); });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupVscode } = await import('../../../src/commands/setup/vscode');
      await expectExit1(() => setupVscode({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('config_write_error');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
