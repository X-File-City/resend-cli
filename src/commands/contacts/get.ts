import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const getContactCommand = new Command('get')
  .description('Retrieve a contact by ID or email address')
  .argument('<id>', 'Contact UUID or email address — both are accepted by the API')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {\n    "object": "contact",\n    "id": "<uuid>",\n    "email": "user@example.com",\n    "first_name": "Jane",\n    "last_name": "Smith",\n    "created_at": "2026-01-01T00:00:00.000Z",\n    "unsubscribed": false,\n    "properties": {}\n  }`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend contacts get 479e3145-dd38-4932-8c0c-e58b548c9e76',
        'resend contacts get user@example.com',
        'resend contacts get 479e3145-dd38-4932-8c0c-e58b548c9e76 --json',
      ],
    }),
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching contact...');

    try {
      const { data, error } = await resend.contacts.get(id);

      if (error) {
        spinner.fail('Failed to fetch contact');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact fetched');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        const name = [d.first_name, d.last_name].filter(Boolean).join(' ');
        console.log(`\n${d.email}${name ? ` (${name})` : ''}`);
        console.log(`ID: ${d.id}`);
        console.log(`Created: ${d.created_at}`);
        console.log(`Unsubscribed: ${d.unsubscribed ? 'yes' : 'no'}`);
        const propEntries = Object.entries(d.properties ?? {});
        if (propEntries.length > 0) {
          console.log('Properties:');
          for (const [key, val] of propEntries) {
            console.log(`  ${key}: ${val.value}`);
          }
        }
      } else {
        outputResult(data!, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch contact');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
