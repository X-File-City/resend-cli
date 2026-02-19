import { Command } from '@commander-js/extra-typings';
import type { CreateBatchOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { readFile } from '../../lib/files';
import { isInteractive } from '../../lib/tty';
import * as p from '@clack/prompts';

export const batchCommand = new Command('batch')
  .description('Send up to 100 emails in a single API request from a JSON file')
  .option('--file <path>', 'Path to a JSON file containing an array of email objects (required in non-interactive mode)')
  .option('--idempotency-key <key>', 'Deduplicate this batch request using this key')
  .addHelpText('after', `
Required: --file (in non-interactive / piped mode)
Limit: 100 emails per request (API hard limit — warned if exceeded)
Unsupported per-email fields: attachments, scheduled_at

File format (--file path):
  [
    {"from":"you@domain.com","to":["user@example.com"],"subject":"Hello","text":"Hi"},
    {"from":"you@domain.com","to":["other@example.com"],"subject":"Hello","html":"<b>Hi</b>"}
  ]

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  [{"id":"<email-id>"},{"id":"<email-id>"}]

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_file | file_read_error | invalid_json | invalid_format | batch_error

Examples:
  $ resend emails batch --file ./emails.json
  $ resend emails batch --file ./emails.json --json
  $ resend emails batch --file ./emails.json --idempotency-key my-batch-2026-02-18
  $ RESEND_API_KEY=re_123 resend emails batch --file ./emails.json --json`)
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    let filePath = opts.file;

    if (!filePath) {
      if (!isInteractive()) {
        outputError(
          { message: 'Missing --file flag. Provide a JSON file with an array of email objects.', code: 'missing_file' },
          { json: globalOpts.json }
        );
      }

      const result = await p.text({
        message: 'Path to JSON file',
        placeholder: './emails.json',
        validate: (v) => (!v ? 'File path is required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Batch cancelled.');
      filePath = result;
    }

    const raw = readFile(filePath!, globalOpts);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      outputError(
        { message: 'File content is not valid JSON.', code: 'invalid_json' },
        { json: globalOpts.json }
      );
    }

    if (!Array.isArray(parsed)) {
      outputError(
        { message: 'File content must be a JSON array of email objects.', code: 'invalid_format' },
        { json: globalOpts.json }
      );
    }

    const emails = parsed as unknown[];

    if (emails.length > 100) {
      console.warn(`Warning: ${emails.length} emails exceeds the 100-email limit. The API may reject this request.`);
    }

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i] as Record<string, unknown>;
      if ('attachments' in email) {
        outputError(
          { message: `Email at index ${i} contains "attachments", which is not supported in batch sends.`, code: 'batch_error' },
          { json: globalOpts.json }
        );
      }
      if ('scheduled_at' in email) {
        outputError(
          { message: `Email at index ${i} contains "scheduled_at", which is not supported in batch sends.`, code: 'batch_error' },
          { json: globalOpts.json }
        );
      }
    }

    const spinner = createSpinner('Sending batch...');

    try {
      const { data, error } = await resend.batch.send(
        emails as CreateBatchOptions,
        opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined
      );

      if (error) {
        spinner.fail('Failed to send batch');
        outputError(
          { message: error.message, code: 'batch_error' },
          { json: globalOpts.json }
        );
      }

      spinner.stop('Batch sent');

      const emailIds = data.data;
      if (!globalOpts.json && isInteractive()) {
        console.log(`Sent ${emailIds.length} email${emailIds.length === 1 ? '' : 's'}`);
        for (const email of emailIds) {
          console.log(`  ${email.id}`);
        }
      } else {
        outputResult(emailIds, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to send batch');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'batch_error' },
        { json: globalOpts.json }
      );
    }
  });
