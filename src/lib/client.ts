import { Resend } from 'resend';
import { resolveApiKey } from './config';
import { errorMessage, outputError } from './output';

export function createClient(flagValue?: string): Resend {
  const resolved = resolveApiKey(flagValue);
  if (!resolved) {
    throw new Error(
      'No API key found. Set RESEND_API_KEY, use --api-key, or run: resend auth login'
    );
  }
  return new Resend(resolved.key);
}

export function requireClient(opts: { apiKey?: string; json?: boolean }): Resend {
  try {
    return createClient(opts.apiKey);
  } catch (err) {
    outputError(
      { message: errorMessage(err, 'Failed to create client'), code: 'auth_error' },
      { json: opts.json }
    );
  }
}
