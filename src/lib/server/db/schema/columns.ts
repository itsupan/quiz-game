/**
 * Column and constraint builders shared by every table, so the conventions in
 * `docs/superpowers/specs/2026-09-07-quiz-game-database-schema-design.md` are written
 * down once instead of copied fifteen times.
 */

import { sql, type SQL } from 'drizzle-orm';
import { integer, text, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

/** `created_at`, defaulting to now. */
export const createdAt = () =>
	integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`);

/**
 * `updated_at`, defaulting to now. SQLite has no ON UPDATE clause, so application code
 * sets this on every write — Drizzle's `$onUpdate` covers the ORM path.
 */
export const updatedAt = () =>
	integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date());

/**
 * The URL-facing identifier. Present only on tables that appear in a route; everything
 * else joins on the integer `id`. Generate with `newPublicId()` from `../ids`.
 */
export const publicId = () => text('public_id').notNull().unique();

/**
 * Builds the `<column> in ('A', 'B')` body of a CHECK constraint.
 *
 * The values are inlined rather than bound, because a CHECK constraint is DDL and
 * cannot carry parameters. That is only safe because every caller passes one of the
 * frozen tuples from `./enums` — never anything derived from a request.
 */
export function checkIn(column: SQLiteColumn, values: readonly string[]): SQL {
	const literals = values.map((value) => `'${value}'`).join(', ');

	return sql`${column} in (${sql.raw(literals)})`;
}
