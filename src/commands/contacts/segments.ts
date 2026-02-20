import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { renderSegmentsTable } from '../segments/utils';
import { segmentContactIdentifier } from './utils';

export const listContactSegmentsCommand = new Command('segments')
  .description('List the segments a contact belongs to')
  .argument('<id>', 'Contact UUID or email address')
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <id> argument accepts either a UUID or an email address.`,
      output: `  {"object":"list","data":[{"id":"<segment-uuid>","name":"Newsletter Subscribers","created_at":"..."}],"has_more":false}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend contacts segments 479e3145-dd38-4932-8c0c-e58b548c9e76',
        'resend contacts segments user@example.com',
        'resend contacts segments 479e3145-dd38-4932-8c0c-e58b548c9e76 --json',
      ],
    }),
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching segments...');

    try {
      const { data, error } = await resend.contacts.segments.list(segmentContactIdentifier(id));

      if (error) {
        spinner.fail('Failed to list segments');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Segments fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderSegmentsTable(list.data));
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list segments');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'list_error' }, { json: globalOpts.json });
    }
  });
