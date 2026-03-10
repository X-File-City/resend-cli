import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { setActiveTeam } from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const switchCommand = new Command('switch')
  .description('Switch the active team profile')
  .argument('<name>', 'Team name to switch to')
  .action((name, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    try {
      setActiveTeam(name);
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to switch team'),
          code: 'switch_failed',
        },
        { json: globalOpts.json },
      );
    }

    if (globalOpts.json) {
      outputResult({ success: true, active_team: name }, { json: true });
    } else if (isInteractive()) {
      console.log(`Switched to team '${name}'.`);
    }
  });
