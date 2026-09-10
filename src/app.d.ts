// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Database } from '$lib/server/db';
import type { AuthUser } from '$lib/server/auth/types';

declare global {
	/**
	 * Secrets, which `wrangler types` cannot see: it generates `Env` from wrangler.jsonc,
	 * and these are pushed with `wrangler secret put --env <environment>` (or set in
	 * .dev.vars locally). Optional, because a deployment that has not had them pushed yet
	 * should fail with the message in `googleConfig`, not a type error at build time.
	 */
	interface Env {
		GOOGLE_CLIENT_ID?: string;
		GOOGLE_CLIENT_SECRET?: string;
		BOOTSTRAP_ADMIN_EMAILS?: string;
	}

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			/** Typed Drizzle client bound to the request's D1 database. */
			db: Database;
			/** The signed-in user, or null for a visitor. Set in `hooks.server.ts`. */
			user: AuthUser | null;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
