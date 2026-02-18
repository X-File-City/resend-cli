import { Command } from '@commander-js/extra-typings';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { renderDomainsTable } from './utils';

export const listDomainsCommand = new Command('list')
  .description('List all domains')
  .option('--limit <n>', 'Maximum number of domains to return (1-100)', '10')
  .option('--after <cursor>', 'Return domains after this cursor (next page)')
  .option('--before <cursor>', 'Return domains before this cursor (previous page)')
  .addHelpText(
    'after',
    `
Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","data":[...],"has_more":true}
  The list response does not include DNS records — use "resend domains get <id>" for that.

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | invalid_limit | list_error

Examples:
  $ resend domains list
  $ resend domains list --limit 25 --json
  $ resend domains list --after <cursor> --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as { apiKey?: string; json?: boolean };

    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching domains...', 'braille');

    try {
      const limit = parseInt(opts.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        outputError(
          { message: '--limit must be an integer between 1 and 100', code: 'invalid_limit' },
          { json: globalOpts.json }
        );
      }
      const paginationOpts = opts.after
        ? { limit, after: opts.after }
        : opts.before
          ? { limit, before: opts.before }
          : { limit };
      const { data, error } = await resend.domains.list(paginationOpts);

      if (error) {
        spinner.fail('Failed to list domains');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('Domains fetched');

      if (!globalOpts.json && isInteractive()) {
        console.log(renderDomainsTable(data!.data));
        if (data!.has_more && data!.data.length > 0) {
          const last = data!.data[data!.data.length - 1];
          console.log(`\nMore results available. Use --after ${last.id} to fetch the next page.`);
        }
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list domains');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'list_error' },
        { json: globalOpts.json }
      );
    }
  });
