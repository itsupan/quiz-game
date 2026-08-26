import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { quizzes } from './schema';

describe('quizzes table', () => {
	const table = getTableConfig(quizzes);

	it('maps to the `quizzes` table created by the migration', () => {
		expect(table.name).toBe('quizzes');
	});

	it('exposes snake_case columns to SQLite', () => {
		expect(table.columns.map((column) => column.name)).toEqual(['id', 'title', 'created_at']);
	});

	it('requires a title and auto-populates the rest', () => {
		const title = table.columns.find((column) => column.name === 'title');
		const createdAt = table.columns.find((column) => column.name === 'created_at');

		expect(title?.notNull).toBe(true);
		expect(title?.hasDefault).toBe(false);
		expect(createdAt?.hasDefault).toBe(true);
	});
});
