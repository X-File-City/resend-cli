import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const deleteContactCommand = new Command('delete')
  .description('Delete a contact')
  .argument('<id>', 'Contact UUID or email address — both are accepted by the API')
  .option('--yes', 'Skip the confirmation prompt (required in non-interactive mode)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <id> argument accepts either a UUID or an email address.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"contact","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend contacts delete 479e3145-dd38-4932-8c0c-e58b548c9e76 --yes',
        'resend contacts delete user@example.com --yes --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(id, `Delete contact ${id}? This cannot be undone.`, globalOpts);
    }

    const spinner = createSpinner('Deleting contact...');

    try {
      const { error } = await resend.contacts.remove(id);

      if (error) {
        spinner.fail('Failed to delete contact');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact deleted');

      if (!globalOpts.json && isInteractive()) {
        console.log('Contact deleted.');
      } else {
        outputResult({ object: 'contact', id, deleted: true }, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to delete contact');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'delete_error' }, { json: globalOpts.json });
    }
  });
