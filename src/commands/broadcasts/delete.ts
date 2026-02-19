import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const deleteBroadcastCommand = new Command('delete')
  .description('Delete a broadcast — draft broadcasts are removed; scheduled broadcasts are cancelled before delivery')
  .argument('<id>', 'Broadcast ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    `
Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.

Warning: Deleting a scheduled broadcast cancels its delivery immediately.
Only draft and scheduled broadcasts can be deleted; sent broadcasts cannot.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"broadcast","id":"<id>","deleted":true}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | confirmation_required | delete_error

Examples:
  $ resend broadcasts delete bcast_123abc --yes
  $ resend broadcasts delete bcast_123abc --yes --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(id, `Delete broadcast ${id}? If scheduled, delivery will be cancelled.`, globalOpts);
    }

    const spinner = createSpinner('Deleting broadcast...');

    try {
      const { data, error } = await resend.broadcasts.remove(id);

      if (error) {
        spinner.fail('Failed to delete broadcast');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('Broadcast deleted');

      if (!globalOpts.json && isInteractive()) {
        console.log('Broadcast deleted.');
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to delete broadcast');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'delete_error' },
        { json: globalOpts.json }
      );
    }
  });
