import { error, fail } from '@sveltejs/kit';

import { ApiProblem } from './http.server';
import { toActionFailure as clientActionFailure, toPageError as clientPageError } from './client';

/**
 * `toPageError` / `toActionFailure` for pages that call the quiz service layer directly
 * instead of going through `/api/v1` with `fetch`. The service throws `ApiProblem`, which
 * maps to the same status and message the HTTP round trip would have produced.
 *
 * Server-only because `ApiProblem` lives in a server module; `client.ts` is also imported
 * from the browser.
 */
export function toPageError(cause: unknown): never {
	if (cause instanceof ApiProblem) {
		error(cause.status, cause.message);
	}
	clientPageError(cause);
}

export function toActionFailure(cause: unknown) {
	if (cause instanceof ApiProblem) {
		return fail(cause.status, { message: cause.message });
	}
	return clientActionFailure(cause);
}
