import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { createSpinner } from '../../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../../lib/output';
import { isInteractive } from '../../../lib/tty';

export const getAttachmentCommand = new Command('attachment')
  .description('Retrieve a single attachment from a received (inbound) email')
  .argument('<emailId>', 'Received email UUID')
  .argument('<attachmentId>', 'Attachment UUID')
  .addHelpText(
    'after',
    `
The download_url is a signed URL that expires in ~1 hour. Download the file directly:
  resend emails receiving attachment <emailId> <attachmentId> --json | jq -r .download_url | xargs curl -O

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"attachment","id":"<uuid>","filename":"invoice.pdf","size":51200,"content_type":"application/pdf","content_disposition":"attachment","content_id":null,"download_url":"<signed-url>","expires_at":"<iso-date>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | fetch_error

Examples:
  $ resend emails receiving attachment <email-id> <attachment-id>
  $ resend emails receiving attachment <email-id> <attachment-id> --json`
  )
  .action(async (emailId, attachmentId, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching attachment...');

    try {
      const { data, error } = await resend.emails.receiving.attachments.get({ emailId, id: attachmentId });

      if (error) {
        spinner.fail('Failed to fetch attachment');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Attachment fetched');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\n${d.filename ?? '(unnamed)'}`);
        console.log(`ID:           ${d.id}`);
        console.log(`Content-Type: ${d.content_type}`);
        console.log(`Size:         ${d.size} bytes`);
        console.log(`Disposition:  ${d.content_disposition}`);
        console.log(`Download URL: ${d.download_url}`);
        console.log(`Expires:      ${d.expires_at}`);
      } else {
        outputResult(data!, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch attachment');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
