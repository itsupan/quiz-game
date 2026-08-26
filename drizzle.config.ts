import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit only generates SQL here — it never talks to D1 directly.
 * Generated migrations land in `migrations/` as flat `.sql` files, which is exactly
 * what `wrangler d1 migrations apply` expects, so Wrangler owns applying them.
 */
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/server/db/schema.ts',
	out: './migrations',
	casing: 'snake_case'
});
