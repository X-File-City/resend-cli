import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const deleteTopicCommand = new Command('delete')
  .description('Delete a topic')
  .argument('<id>', 'Topic UUID')
  .option('--yes', 'Skip the confirmation prompt (required in non-interactive mode)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting a topic removes all contact subscriptions to that topic and may affect
  broadcasts that reference this topic_id. Contacts themselves are not deleted.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"topic","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend topics delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
        'resend topics delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(
        id,
        `Delete topic ${id}? All contact subscriptions and broadcast associations will be removed.`,
        globalOpts
      );
    }

    await withSpinner(
      { loading: 'Deleting topic...', success: 'Topic deleted', fail: 'Failed to delete topic' },
      () => resend.topics.remove(id),
      'delete_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log('Topic deleted.');
    } else {
      outputResult({ object: 'topic', id, deleted: true }, { json: globalOpts.json });
    }
  });
