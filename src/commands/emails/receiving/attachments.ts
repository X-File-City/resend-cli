import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { createSpinner } from '../../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../../lib/output';
import { parseLimitOpt, buildPaginationOpts, printPaginationHint } from '../../../lib/pagination';
import { isInteractive } from '../../../lib/tty';
import { renderAttachmentsTable } from './utils';

export const listAttachmentsCommand = new Command('attachments')
  .description('List attachments on a received (inbound) email')
  .argument('<emailId>', 'Received email UUID')
  .option('--limit <n>', 'Maximum number of attachments to return (1-100)', '10')
  .option('--after <cursor>', 'Return attachments after this cursor (next page)')
  .option('--before <cursor>', 'Return attachments before this cursor (previous page)')
  .addHelpText(
    'after',
    `
Each attachment has a download_url (signed, expires ~1 hour).
Use the attachment sub-command to retrieve a single attachment with its download URL:
  resend emails receiving attachment <emailId> <attachmentId>

content_disposition: "inline" means the attachment is embedded in the HTML body (e.g. an image).
content_disposition: "attachment" means it is a standalone file download.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","has_more":false,"data":[{"id":"<uuid>","filename":"invoice.pdf","size":51200,"content_type":"application/pdf","content_disposition":"attachment","content_id":null,"download_url":"<url>","expires_at":"<iso-date>"}]}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | fetch_error

Examples:
  $ resend emails receiving attachments <email-id>
  $ resend emails receiving attachments <email-id> --json
  $ resend emails receiving attachments <email-id> --limit 25 --json`
  )
  .action(async (emailId, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const spinner = createSpinner('Fetching attachments...');

    try {
      const { data, error } = await resend.emails.receiving.attachments.list({ emailId, ...paginationOpts });

      if (error) {
        spinner.fail('Failed to list attachments');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Attachments fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderAttachmentsTable(list.data));
        printPaginationHint(list);
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list attachments');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
