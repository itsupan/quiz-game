import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { Database } from './index';
import * as schema from './schema';

/**
 * A real SQLite database for tests, built from the same migrations D1 runs.
 *
 * TEST ONLY. It imports `node:sqlite`, which does not exist in workerd, so if this file
 * ever gets pulled into application code the Worker build fails loudly rather than
 * shipping something broken.
 *
 * Why bother, when there are already E2E tests: the interesting behaviour of a session is
 * expiry, renewal and deletion, and the interesting behaviour of a sign-in is that it
 * creates exactly one user however many times it happens. Those are cheap to assert
 * against a database and awkward to assert through a browser, and faking a Drizzle query
 * builder well enough to test them would prove nothing about the SQL.
 *
 * `db.batch()` is a D1 extension and is NOT available here — code that batches has to be
 * covered by the Playwright suite instead.
 */
export type TestDatabase = Database;

const MIGRATIONS = [
	'migrations/0000_init.sql',
	'migrations/0001_schema.sql',
	'migrations/0002_add_password_hash.sql'
];

/**
 * Splits a drizzle-kit migration into executable statements.
 *
 * `-->` here is SQL, not HTML: `--` is SQL's line-comment marker, drizzle-kit writes
 * `--> statement-breakpoint` as its separator, and the notes in 0001_schema.sql use the
 * same prefix. Dropped line by line rather than by regex — clearer than a pattern, and it
 * stops CodeQL's `js/bad-tag-filter` heuristic reading `-->` as an HTML comment terminator.
 */
function statements(file: string): string[] {
	return readFileSync(file, 'utf8')
		.split('--> statement-breakpoint')
		.map((chunk) =>
			chunk
				.split('\n')
				.filter((line) => !line.startsWith('-->'))
				.join('\n')
				.trim()
		)
		.filter((chunk) => chunk.length > 0);
}

export function createTestDatabase() {
	const sqlite = new DatabaseSync(':memory:');

	// D1 enforces foreign keys; an in-memory SQLite does not unless asked, and every
	// interesting constraint in this schema is a foreign key.
	sqlite.exec('PRAGMA foreign_keys = ON');

	for (const file of MIGRATIONS) {
		for (const statement of statements(file)) {
			sqlite.exec(statement);
		}
	}

	const db = drizzle(
		async (sql, params, method) => {
			const statement = sqlite.prepare(sql);

			// Drizzle's proxy driver maps result columns by position, not by name.
			statement.setReturnArrays(true);

			const values = params.map((param) => {
				if (param === undefined) return null;
				if (typeof param === 'boolean') return param ? 1 : 0;

				return param;
			}) as never[];

			if (method === 'run') {
				statement.run(...values);

				return { rows: [] };
			}

			if (method === 'get') {
				return { rows: (statement.get(...values) as unknown as unknown[]) ?? [] };
			}

			return { rows: statement.all(...values) as unknown as unknown[][] };
		},
		{ schema }
	);

	return {
		// The proxy driver and the D1 driver differ only in their result envelope, which
		// nothing here reads. Asserting the D1 type once, here, keeps every module under
		// test typed against the driver it actually ships with.
		db: db as unknown as Database,
		sqlite,
		close: () => sqlite.close()
	};
}
