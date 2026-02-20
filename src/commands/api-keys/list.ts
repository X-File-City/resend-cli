import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { renderApiKeysTable } from './utils';
import { buildHelpText } from '../../lib/help-text';

export const listApiKeysCommand = new Command('list')
  .description('List all API keys (IDs and names — tokens are never returned by this endpoint)')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"list","data":[{"id":"<id>","name":"<name>","created_at":"<date>"}]}
  Tokens are never included in list responses.`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend api-keys list',
        'resend api-keys list --json',
      ],
    })
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    const list = await withSpinner(
      { loading: 'Fetching API keys...', success: 'API keys fetched', fail: 'Failed to list API keys' },
      () => resend.apiKeys.list(),
      'list_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(renderApiKeysTable(list.data));
    } else {
      outputResult(list, { json: globalOpts.json });
    }
  });
