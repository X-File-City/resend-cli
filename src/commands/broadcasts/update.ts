import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { readHtmlFile } from '../../lib/files';
import { isInteractive } from '../../lib/tty';

export const updateBroadcastCommand = new Command('update')
  .description('Update a draft broadcast — only drafts can be updated; sent broadcasts are immutable')
  .argument('<id>', 'Broadcast ID')
  .option('--from <address>', 'Update sender address')
  .option('--subject <subject>', 'Update subject')
  .option('--html <html>', 'Update HTML body (supports {{{FIRST_NAME|fallback}}} variable interpolation)')
  .option('--html-file <path>', 'Path to an HTML file to replace the body (supports {{{FIRST_NAME|fallback}}} variable interpolation)')
  .option('--text <text>', 'Update plain-text body')
  .option('--name <name>', 'Update internal label')
  .addHelpText(
    'after',
    `
Note: Only draft broadcasts can be updated.
If the broadcast is already sent or sending, the API will return an error.

Variable interpolation:
  HTML bodies support triple-brace syntax for contact properties.
  Example: {{{FIRST_NAME|Friend}}} — uses FIRST_NAME or falls back to "Friend".

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"id":"<broadcast-id>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | file_read_error | update_error

Examples:
  $ resend broadcasts update bcast_123abc --subject "Updated Subject"
  $ resend broadcasts update bcast_123abc --html-file ./new-email.html
  $ resend broadcasts update bcast_123abc --name "Q1 Newsletter" --from "news@domain.com" --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let html = opts.html;

    if (opts.htmlFile) {
      html = readHtmlFile(opts.htmlFile, globalOpts);
    }

    const spinner = createSpinner('Updating broadcast...');

    try {
      const { data, error } = await resend.broadcasts.update(id, {
        ...(opts.from && { from: opts.from }),
        ...(opts.subject && { subject: opts.subject }),
        ...(html && { html }),
        ...(opts.text && { text: opts.text }),
        ...(opts.name && { name: opts.name }),
      });

      if (error) {
        spinner.fail('Failed to update broadcast');
        outputError({ message: error.message, code: 'update_error' }, { json: globalOpts.json });
      }

      spinner.stop('Broadcast updated');

      if (!globalOpts.json && isInteractive()) {
        console.log(`\nBroadcast updated: ${data!.id}`);
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to update broadcast');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'update_error' },
        { json: globalOpts.json }
      );
    }
  });
