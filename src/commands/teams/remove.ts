import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { removeTeam } from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export const removeCommand = new Command('remove')
  .description('Remove a team profile')
  .argument('<name>', 'Team name to remove')
  .action(async (name, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (!globalOpts.json && isInteractive()) {
      const confirmed = await p.confirm({
        message: `Remove team '${name}' and its API key?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        cancelAndExit('Remove cancelled.');
      }
    }

    try {
      removeTeam(name);
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to remove team'),
          code: 'remove_failed',
        },
        { json: globalOpts.json },
      );
    }

    if (globalOpts.json) {
      outputResult({ success: true, removed_team: name }, { json: true });
    } else if (isInteractive()) {
      console.log(`Team '${name}' removed.`);
    }
  });
