import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { renderTopicsTable } from './utils';
import { buildHelpText } from '../../lib/help-text';

export const listTopicsCommand = new Command('list')
  .description('List all topics')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Returns all topics in your account. Topic subscription management for individual
contacts is handled via "resend contacts topics <contactId>".`,
      output: `  {"data":[{"id":"<uuid>","name":"<name>","description":"<desc>","default_subscription":"opt_in|opt_out","created_at":"<iso-date>"}]}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend topics list',
        'resend topics list --json',
      ],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const list = await withSpinner(
      { loading: 'Fetching topics...', success: 'Topics fetched', fail: 'Failed to list topics' },
      () => resend.topics.list(),
      'list_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(renderTopicsTable(list.data));
    } else {
      outputResult(list, { json: globalOpts.json });
    }
  });
