// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Database } from '$lib/server/db';
import type { AuthUser } from '$lib/server/auth/user';

declare global {
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
