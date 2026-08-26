import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

/**
 * Attaches a per-request Drizzle client to `event.locals`, so routes query the
 * database through `locals.db` and never touch `platform` directly.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb(event.platform);

	return resolve(event);
};
