import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { DEPRECATION_MSG, MIGRATION_URL } from './utils';

export const createAudienceCommand = new Command('create')
  .description('Create a new audience [deprecated — use `resend segments create`]')
  .option('--name <name>', 'Audience name (required)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `⚠ DEPRECATED: Audiences are deprecated. Use segments instead.
  Migration guide: ${MIGRATION_URL}

Non-interactive: --name is required.`,
      output: `  {
    "deprecated": true,
    "deprecation_message": "Audiences are deprecated. Use segments instead.",
    "data": {"object":"segment","id":"<uuid>","name":"<name>"}
  }`,
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend audiences create --name "My Audience"',
        'resend audiences create --name "My Audience" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let name = opts.name;

    if (!name) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --name flag.', code: 'missing_name' }, { json: globalOpts.json });
      }
      const result = await p.text({
        message: 'Audience name',
        placeholder: 'My Audience',
        validate: (v) => (!v ? 'Name is required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      name = result;
    }

    const data = await withSpinner(
      { loading: 'Creating audience...', success: 'Audience created', fail: 'Failed to create audience' },
      () => resend.audiences.create({ name: name! }),
      'create_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      const d = data;
      console.log(`\nAudience created: ${d.id}`);
      console.log(`Name: ${d.name}`);
    } else {
      outputResult({ deprecated: true, deprecation_message: DEPRECATION_MSG, data }, { json: globalOpts.json });
    }
  });
