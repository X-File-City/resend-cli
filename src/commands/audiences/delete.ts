import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { DEPRECATION_MSG, MIGRATION_URL } from './utils';

export const deleteAudienceCommand = new Command('delete')
  .description('Delete an audience [deprecated — use `resend segments delete`]')
  .argument('<id>', 'Audience UUID')
  .option('--yes', 'Skip the confirmation prompt (required in non-interactive mode)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `⚠ DEPRECATED: Audiences are deprecated. Use segments instead.
  Migration guide: ${MIGRATION_URL}

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {
    "deprecated": true,
    "deprecation_message": "Audiences are deprecated. Use segments instead.",
    "data": {"object":"audience","id":"<uuid>","deleted":true}
  }`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend audiences delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
        'resend audiences delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(
        id,
        `Delete audience ${id}? This cannot be undone.`,
        globalOpts
      );
    }

    await withSpinner(
      { loading: 'Deleting audience...', success: 'Audience deleted', fail: 'Failed to delete audience' },
      () => resend.audiences.remove(id),
      'delete_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log('Audience deleted.');
    } else {
      outputResult(
        { deprecated: true, deprecation_message: DEPRECATION_MSG, data: { object: 'audience', id, deleted: true } },
        { json: globalOpts.json }
      );
    }
  });
