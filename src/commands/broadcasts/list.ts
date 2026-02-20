import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { parseLimitOpt, buildPaginationOpts, printPaginationHint } from '../../lib/pagination';
import { isInteractive } from '../../lib/tty';
import { renderBroadcastsTable } from './utils';
import { buildHelpText } from '../../lib/help-text';

export const listBroadcastsCommand = new Command('list')
  .description('List broadcasts — returns summary objects (use "get <id>" for full details including html/text)')
  .option('--limit <n>', 'Maximum number of results to return (1-100)', '10')
  .option('--after <cursor>', 'Cursor for forward pagination — list items after this ID')
  .option('--before <cursor>', 'Cursor for backward pagination — list items before this ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: List results include name, status, created_at, and id only.
To retrieve full details (html, from, subject), use: resend broadcasts get <id>`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"...","name":"...","status":"draft|queued|sent","created_at":"..."}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend broadcasts list',
        'resend broadcasts list --limit 5',
        'resend broadcasts list --after bcast_abc --limit 10',
        'resend broadcasts list --json',
      ],
    })
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    const list = await withSpinner(
      { loading: 'Fetching broadcasts...', success: 'Broadcasts fetched', fail: 'Failed to list broadcasts' },
      () => resend.broadcasts.list(paginationOpts),
      'list_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(renderBroadcastsTable(list.data));
      printPaginationHint(list);
    } else {
      outputResult(list, { json: globalOpts.json });
    }
  });
