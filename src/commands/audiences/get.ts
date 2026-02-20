import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { DEPRECATION_MSG, MIGRATION_URL } from './utils';

export const getAudienceCommand = new Command('get')
  .description('Retrieve an audience by ID [deprecated — use `resend segments get`]')
  .argument('<id>', 'Audience UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `⚠ DEPRECATED: Audiences are deprecated. Use segments instead.
  Migration guide: ${MIGRATION_URL}`,
      output: `  {
    "deprecated": true,
    "deprecation_message": "Audiences are deprecated. Use segments instead.",
    "data": {"object":"segment","id":"<uuid>","name":"<name>","created_at":"<iso-date>"}
  }`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend audiences get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend audiences get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching audience...');

    try {
      const { data, error } = await resend.audiences.get(id);

      if (error) {
        spinner.fail('Failed to fetch audience');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Audience fetched');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\n${d.name}`);
        console.log(`ID: ${d.id}`);
        console.log(`Created: ${d.created_at}`);
      } else {
        outputResult({ deprecated: true, deprecation_message: DEPRECATION_MSG, data }, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch audience');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
