import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export const createSegmentCommand = new Command('create')
  .description('Create a new segment')
  .option('--name <name>', 'Segment name (required)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Segments are named groups of contacts. Broadcasts target segments via segment_id.
Contacts can belong to multiple segments. Audiences are deprecated — use segments instead.

Non-interactive: --name is required.`,
      output: `  {"object":"segment","id":"<uuid>","name":"<name>"}`,
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend segments create --name "Newsletter Subscribers"',
        'resend segments create --name "Beta Users" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    let name = opts.name;

    if (!name) {
      if (!isInteractive()) {
        outputError(
          { message: 'Missing --name flag.', code: 'missing_name' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'Segment name',
        placeholder: 'Newsletter Subscribers',
        validate: (v) => (!v ? 'Name is required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      name = result;
    }

    await runCreate(
      {
        spinner: {
          loading: 'Creating segment...',
          success: 'Segment created',
          fail: 'Failed to create segment',
        },
        sdkCall: (resend) => resend.segments.create({ name: name! }),
        onInteractive: (data) => {
          console.log(`\nSegment created: ${data.id}`);
          console.log(`Name: ${data.name}`);
        },
      },
      globalOpts,
    );
  });
