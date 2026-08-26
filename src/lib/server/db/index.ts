import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = ReturnType<typeof getDb>;

/**
 * Wraps the D1 binding in a typed Drizzle client.
 *
 * `platform` is populated by adapter-cloudflare: from `.wrangler/state` during
 * `pnpm dev` / `pnpm preview`, and from the real D1 database once deployed.
 */
export function getDb(
	platform: App.Platform | undefined
): ReturnType<typeof drizzle<typeof schema>> {
	const d1 = platform?.env?.DB;

	if (!d1) {
		throw new Error(
			'The D1 binding `DB` is unavailable. Start the app with `pnpm dev` or `pnpm preview` so Wrangler can supply bindings, and check the `d1_databases` entry in wrangler.jsonc.'
		);
	}

	return drizzle(d1, { schema });
}

export { schema };
