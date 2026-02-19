import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const sendBroadcastCommand = new Command('send')
  .description('Send a draft broadcast (API-created drafts only — dashboard broadcasts cannot be sent via API)')
  .argument('<id>', 'Broadcast ID')
  .option('--scheduled-at <datetime>', 'Schedule delivery — ISO 8601 or natural language e.g. "in 1 hour", "tomorrow at 9am ET"')
  .addHelpText(
    'after',
    `
Note: Only broadcasts created via the API can be sent via this command.
Broadcasts created in the Resend dashboard cannot be sent programmatically.

Scheduling:
  --scheduled-at accepts ISO 8601 (e.g. 2026-08-05T11:52:01Z) or
  natural language (e.g. "in 1 hour", "tomorrow at 9am ET").

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"id":"<broadcast-id>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | send_error

Examples:
  $ resend broadcasts send bcast_123abc
  $ resend broadcasts send bcast_123abc --scheduled-at "in 1 hour"
  $ resend broadcasts send bcast_123abc --scheduled-at "2026-08-05T11:52:01Z" --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Sending broadcast...');

    try {
      const { data, error } = await resend.broadcasts.send(id, {
        ...(opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
      });

      if (error) {
        spinner.fail('Failed to send broadcast');
        outputError({ message: error.message, code: 'send_error' }, { json: globalOpts.json });
      }

      spinner.stop('Broadcast sent');

      if (!globalOpts.json && isInteractive()) {
        if (opts.scheduledAt) {
          console.log(`\nBroadcast scheduled: ${data!.id} (sends: ${opts.scheduledAt})`);
        } else {
          console.log(`\nBroadcast sent: ${data!.id}`);
        }
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to send broadcast');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'send_error' },
        { json: globalOpts.json }
      );
    }
  });
