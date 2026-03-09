import * as p from '@clack/prompts';
import type { GlobalOpts } from './client';
import { outputError } from './output';
import { isInteractive } from './tty';

export interface FieldSpec {
  flag: string;
  message: string;
  placeholder?: string;
  required?: boolean;
  validate?: (value: string | undefined) => string | undefined;
}

export function cancelAndExit(message: string): never {
  p.cancel(message);
  process.exit(0);
}

/**
 * Guard a delete action: error in non-interactive mode (no --yes), or show a
 * confirmation prompt in interactive mode. Exits the process on cancel/rejection.
 */
export async function confirmDelete(
  _id: string,
  confirmMessage: string,
  globalOpts: GlobalOpts,
): Promise<void> {
  if (!isInteractive()) {
    outputError(
      {
        message: 'Use --yes to confirm deletion in non-interactive mode.',
        code: 'confirmation_required',
      },
      { json: globalOpts.json },
    );
  }

  const confirmed = await p.confirm({ message: confirmMessage });
  if (p.isCancel(confirmed) || !confirmed) {
    cancelAndExit('Deletion cancelled.');
  }
}

export async function promptForMissing<
  T extends Record<string, string | undefined>,
>(current: T, fields: FieldSpec[], globalOpts: GlobalOpts): Promise<T> {
  const missing = fields.filter(
    (f) => f.required !== false && !current[f.flag],
  );

  if (missing.length === 0) {
    return current;
  }

  if (!isInteractive()) {
    const flags = missing.map((f) => `--${f.flag}`).join(', ');
    outputError(
      { message: `Missing required flags: ${flags}`, code: 'missing_flags' },
      { json: globalOpts.json },
    );
  }

  const result = await p.group(
    Object.fromEntries(
      missing.map((field) => [
        field.flag,
        () =>
          p.text({
            message: field.message,
            placeholder: field.placeholder,
            validate:
              field.validate ??
              ((v) =>
                !v || v.length === 0
                  ? `${field.message} is required`
                  : undefined),
          }),
      ]),
    ),
    {
      onCancel: () => cancelAndExit('Operation cancelled.'),
    },
  );

  return { ...current, ...result } as T;
}
