import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { renderSegmentsTable } from '../segments/utils';
import { DEPRECATION_MSG, MIGRATION_URL } from './utils';

export const listAudiencesCommand = new Command('list')
  .description('List all audiences [deprecated — use `resend segments list`]')
  .addHelpText(
    'after',
    buildHelpText({
      context: `⚠ DEPRECATED: Audiences are deprecated. Use segments instead.
  Migration guide: ${MIGRATION_URL}`,
      output: `  {
    "deprecated": true,
    "deprecation_message": "Audiences are deprecated. Use segments instead.",
    "data": {"object":"list","data":[{"id":"<uuid>","name":"<name>","created_at":"<iso-date>"}],"has_more":false}
  }`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend audiences list',
        'resend audiences list --json',
      ],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const list = await withSpinner(
      { loading: 'Fetching audiences...', success: 'Audiences fetched', fail: 'Failed to list audiences' },
      () => resend.audiences.list(),
      'list_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(renderSegmentsTable(list.data));
    } else {
      outputResult({ deprecated: true, deprecation_message: DEPRECATION_MSG, data: list }, { json: globalOpts.json });
    }
  });
