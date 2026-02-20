import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { createAudienceCommand } from './create';
import { getAudienceCommand } from './get';
import { listAudiencesCommand } from './list';
import { deleteAudienceCommand } from './delete';
import { MIGRATION_URL } from './utils';

export const audiencesCommand = new Command('audiences')
  .description('Manage audiences [deprecated — use `resend segments`]')
  .addHelpText(
    'after',
    buildHelpText({
      context: `⚠ DEPRECATED: Audiences are the legacy predecessor to Segments. All new work should
  use "resend segments". Existing audiences can still be listed and deleted during
  migration, but no new features will be added to this namespace.

  Migration guide: ${MIGRATION_URL}

Subcommands:
  create   Create a new audience
  get      Retrieve an audience by ID
  list     List all audiences
  delete   Delete an audience

Use "resend segments --help" to see the modern equivalent.`,
      examples: [
        'resend audiences list --json              # export all audience IDs before migration',
        'resend audiences delete <id> --yes --json # delete audiences after migrating contacts',
        'resend segments list                      # modern equivalent',
      ],
    }),
  )
  .hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals() as GlobalOpts;
    if (isInteractive() && !opts.json) {
      process.stderr.write(
        `⚠  Audiences are deprecated. Use \`resend segments\` instead.\n` +
          `   Migration guide: ${MIGRATION_URL}\n\n`
      );
    }
  })
  .addCommand(createAudienceCommand)
  .addCommand(getAudienceCommand)
  .addCommand(listAudiencesCommand)
  .addCommand(deleteAudienceCommand);
