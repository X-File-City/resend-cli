import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const deleteContactPropertyCommand = new Command('delete')
  .description('Delete a contact property definition')
  .argument('<id>', 'Contact property UUID')
  .option('--yes', 'Skip the confirmation prompt (required in non-interactive mode)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `WARNING: Deleting a property definition removes that property value from ALL contacts
permanently. This cannot be undone, and any broadcasts that reference this property key
via {{{PROPERTY_NAME}}} will render an empty string or their inline fallback instead.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"contact_property","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend contact-properties delete prop_abc123 --yes',
        'resend contact-properties delete prop_abc123 --yes --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(
        id,
        `Delete contact property "${id}"? This will remove this property from ALL contacts permanently.`,
        globalOpts
      );
    }

    await withSpinner(
      { loading: 'Deleting contact property...', success: 'Contact property deleted', fail: 'Failed to delete contact property' },
      () => resend.contactProperties.remove(id),
      'delete_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log('Contact property deleted.');
    } else {
      outputResult({ object: 'contact_property', id, deleted: true }, { json: globalOpts.json });
    }
  });
