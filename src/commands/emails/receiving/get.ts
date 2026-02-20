import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { createSpinner } from '../../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../../lib/output';
import { isInteractive } from '../../../lib/tty';

export const getReceivingCommand = new Command('get')
  .description('Retrieve a single received (inbound) email with full details including HTML, text, and headers')
  .argument('<id>', 'Received email UUID')
  .addHelpText(
    'after',
    `
The raw.download_url field is a signed URL (expires ~1 hour) containing the full RFC 2822
MIME message. Pipe it to curl to save the original email:
  resend emails receiving get <id> --json | jq -r .raw.download_url | xargs curl > email.eml

Attachments are listed in the attachments array. Use the attachments sub-command to get
download URLs:
  resend emails receiving attachments <id>

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"email","id":"<uuid>","to":["inbox@yourdomain.com"],"from":"sender@external.com","subject":"Hello","html":"<p>Hello!</p>","text":"Hello!","headers":{"x-mailer":"..."},"message_id":"<str>","bcc":[],"cc":[],"reply_to":[],"raw":{"download_url":"<url>","expires_at":"<iso-date>"},"attachments":[]}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | fetch_error

Examples:
  $ resend emails receiving get <email-id>
  $ resend emails receiving get <email-id> --json`
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching received email...');

    try {
      const { data, error } = await resend.emails.receiving.get(id);

      if (error) {
        spinner.fail('Failed to fetch received email');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Received email fetched');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\nFrom:    ${d.from}`);
        console.log(`To:      ${d.to.join(', ')}`);
        console.log(`Subject: ${d.subject}`);
        console.log(`Date:    ${d.created_at}`);
        if (d.attachments.length > 0) {
          console.log(`Files:   ${d.attachments.length} attachment(s)`);
        }
        if (d.text) {
          const snippet = d.text.length > 200 ? `${d.text.slice(0, 197)}...` : d.text;
          console.log(`\n${snippet}`);
        } else if (d.html) {
          console.log('\n(HTML body only — use --json to view or pipe to a browser)');
        }
      } else {
        outputResult(data!, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch received email');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
