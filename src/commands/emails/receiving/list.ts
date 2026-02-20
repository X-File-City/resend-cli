import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { createSpinner } from '../../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../../lib/output';
import { parseLimitOpt, buildPaginationOpts, printPaginationHint } from '../../../lib/pagination';
import { isInteractive } from '../../../lib/tty';
import { renderReceivingEmailsTable } from './utils';

export const listReceivingCommand = new Command('list')
  .description('List received (inbound) emails for domains with receiving enabled')
  .option('--limit <n>', 'Maximum number of emails to return (1-100)', '10')
  .option('--after <cursor>', 'Return emails after this cursor (next page)')
  .option('--before <cursor>', 'Return emails before this cursor (previous page)')
  .addHelpText(
    'after',
    `
Receiving must be enabled on the domain first:
  resend domains update <id> --receiving enabled

Pagination: use --after or --before with a received email ID as the cursor.
Only one of --after or --before may be used at a time.
The response includes has_more: true when additional pages exist.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","has_more":false,"data":[{"id":"<uuid>","to":["inbox@yourdomain.com"],"from":"sender@external.com","subject":"Hello","created_at":"<iso-date>","message_id":"<str>","bcc":null,"cc":null,"reply_to":null,"attachments":[]}]}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | list_error

Examples:
  $ resend emails receiving list
  $ resend emails receiving list --limit 25 --json
  $ resend emails receiving list --after <email-id> --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching received emails...');

    try {
      const { data, error } = await resend.emails.receiving.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list received emails');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Received emails fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderReceivingEmailsTable(list.data));
        printPaginationHint(list);
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list received emails');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'list_error' }, { json: globalOpts.json });
    }
  });
