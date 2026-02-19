import { Command } from '@commander-js/extra-typings';
import { execFile } from 'node:child_process';
import * as p from '@clack/prompts';
import { cancelAndExit } from '../../lib/prompts';
import { Resend } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { resolveApiKey, storeApiKey } from '../../lib/config';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

const RESEND_API_KEYS_URL = 'https://resend.com/api-keys';

function openInBrowser(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    // `start` on Windows is a shell built-in, not an executable.
    // Must invoke via `cmd.exe /c start <url>`.
    const cmd = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
    execFile(cmd, args, { timeout: 5000 }, (err) => resolve(!err));
  });
}

export const loginCommand = new Command('login')
  .description('Save a Resend API key to the local credentials file')
  .option('--key <key>', 'API key to store (required in non-interactive mode)')
  .addHelpText('after', `
Non-interactive: --key is required (no prompts will appear when stdin/stdout is not a TTY)

Alternative: Set RESEND_API_KEY environment variable — no login needed.
Credentials stored at: ~/.config/resend/credentials.json
  (Linux: $XDG_CONFIG_HOME/resend/credentials.json)
  (Windows: %APPDATA%\\resend\\credentials.json)

Global options (defined on root):
  --json  Force JSON output

Output (--json):
  {"success":true,"config_path":"<path>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: missing_key | invalid_key_format | validation_failed

Examples:
  $ resend auth login --key re_123456789
  $ resend auth login                      (interactive — prompts and opens browser)
  $ RESEND_API_KEY=re_123 resend emails send ...  (skip login; use env var directly)`)
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    let apiKey = opts.key;

    if (!apiKey) {
      if (!isInteractive()) {
        outputError(
          { message: 'Missing --key flag. Provide your API key in non-interactive mode.', code: 'missing_key' },
          { json: globalOpts.json }
        );
      }

      p.intro('Resend Authentication');

      const existing = resolveApiKey();
      if (existing) {
        p.log.info(`Existing API key found (source: ${existing.source}). Enter a new key to replace it.`);
      } else {
        const shouldOpen = await p.confirm({
          message: 'No API key found. Open Resend dashboard to create one?',
        });

        if (p.isCancel(shouldOpen)) cancelAndExit('Login cancelled.');

        if (shouldOpen) {
          const opened = await openInBrowser(RESEND_API_KEYS_URL);
          if (opened) {
            p.log.info(`Opened ${RESEND_API_KEYS_URL}`);
          } else {
            p.log.warn(`Could not open browser. Visit ${RESEND_API_KEYS_URL} manually.`);
          }
        }
      }

      const result = await p.password({
        message: 'Enter your Resend API key:',
        validate: (value) => {
          if (!value) return 'API key is required';
          if (!value.startsWith('re_')) return 'API key must start with re_';
          return undefined;
        },
      });

      if (p.isCancel(result)) cancelAndExit('Login cancelled.');

      apiKey = result;
    }

    if (!apiKey.startsWith('re_')) {
      outputError(
        { message: 'Invalid API key format. Key must start with re_', code: 'invalid_key_format' },
        { json: globalOpts.json }
      );
    }

    const spinner = createSpinner('Validating API key...');

    try {
      const resend = new Resend(apiKey);
      await resend.domains.list();
      spinner.stop('API key is valid');
    } catch (err) {
      spinner.fail('API key validation failed');
      outputError(
        { message: errorMessage(err, 'Failed to validate API key'), code: 'validation_failed' },
        { json: globalOpts.json }
      );
    }

    const configPath = storeApiKey(apiKey);

    if (globalOpts.json) {
      outputResult({ success: true, config_path: configPath }, { json: true });
    } else {
      if (isInteractive()) {
        p.outro(`API key stored at ${configPath}`);
      } else {
        console.log(`API key stored at ${configPath}`);
      }
    }
  });
