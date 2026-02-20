import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const deleteBroadcastCommand = new Command('delete')
  .description('Delete a broadcast — draft broadcasts are removed; scheduled broadcasts are cancelled before delivery')
  .argument('<id>', 'Broadcast ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting a scheduled broadcast cancels its delivery immediately.
Only draft and scheduled broadcasts can be deleted; sent broadcasts cannot.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"broadcast","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend broadcasts delete bcast_123abc --yes',
        'resend broadcasts delete bcast_123abc --yes --json',
      ],
    })
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(id, `Delete broadcast ${id}? If scheduled, delivery will be cancelled.`, globalOpts);
    }

    await withSpinner(
      { loading: 'Deleting broadcast...', success: 'Broadcast deleted', fail: 'Failed to delete broadcast' },
      () => resend.broadcasts.remove(id),
      'delete_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log('Broadcast deleted.');
    } else {
      outputResult({ object: 'broadcast', id, deleted: true }, { json: globalOpts.json });
    }
  });
