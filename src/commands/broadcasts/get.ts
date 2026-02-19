import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { broadcastStatusIndicator } from './utils';

export const getBroadcastCommand = new Command('get')
  .description('Retrieve full details for a broadcast including HTML body, status, and delivery times')
  .argument('<id>', 'Broadcast ID')
  .addHelpText(
    'after',
    `
Note: The list command returns summary objects without html/text/from/subject.
Use this command to retrieve the full broadcast payload.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"id":"...","object":"broadcast","name":"...","segment_id":"...","from":"...","subject":"...","status":"draft|queued|sent","created_at":"...","scheduled_at":null,"sent_at":null}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | fetch_error

Examples:
  $ resend broadcasts get bcast_123abc
  $ resend broadcasts get bcast_123abc --json`
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching broadcast...');

    try {
      const { data, error } = await resend.broadcasts.get(id);

      if (error) {
        spinner.fail('Failed to fetch broadcast');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Broadcast fetched');

      if (!globalOpts.json && isInteractive()) {
        const b = data!;
        console.log(`\nBroadcast: ${b.id}`);
        console.log(`  Status:      ${broadcastStatusIndicator(b.status)}`);
        console.log(`  Name:        ${b.name ?? '(untitled)'}`);
        console.log(`  From:        ${b.from ?? '—'}`);
        console.log(`  Subject:     ${b.subject ?? '—'}`);
        console.log(`  Segment:     ${b.segment_id ?? '—'}`);
        if (b.preview_text) console.log(`  Preview:     ${b.preview_text}`);
        if (b.topic_id) console.log(`  Topic:       ${b.topic_id}`);
        console.log(`  Created:     ${b.created_at}`);
        if (b.scheduled_at) console.log(`  Scheduled:   ${b.scheduled_at}`);
        if (b.sent_at) console.log(`  Sent:        ${b.sent_at}`);
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch broadcast');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'fetch_error' },
        { json: globalOpts.json }
      );
    }
  });
