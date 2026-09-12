import { beforeEach, describe, expect, it } from 'vitest';

import { listQuestions } from '$lib/features/questions/questions.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { mediaAssets, questions, users } from '$lib/server/db/schema';

let db: TestDatabase;
let adminId: number;

beforeEach(async () => {
	db = createTestDatabase().db;

	const [admin] = await db
		.insert(users)
		.values({ email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN' })
		.returning({ id: users.id });
	adminId = admin.id;
});

async function insertQuestion(overrides: Partial<typeof questions.$inferInsert> = {}) {
	const [question] = await db
		.insert(questions)
		.values({
			stem: 'stem',
			level: 'N4',
			section: 'VOCAB_KANJI',
			createdBy: adminId,
			...overrides
		})
		.returning();

	return question;
}

describe('listQuestions text search', () => {
	it('matches a substring of the stem', async () => {
		await insertQuestion({ stem: 'この漢字の読み方はどれですか。「病院」' });
		await insertQuestion({ stem: 'unrelated question' });

		const { items } = await listQuestions(db, { q: '病院' });

		expect(items).toHaveLength(1);
		expect(items[0].stem).toContain('病院');
	});

	it('matches a substring of focusText for vocabulary/kanji formats', async () => {
		await insertQuestion({
			format: 'VOCABULARY_MEANING',
			stem: 'stem a',
			focusText: '図書館'
		});
		await insertQuestion({ format: 'STANDARD', stem: 'stem b' });

		const { items } = await listQuestions(db, { q: '図書館' });

		expect(items).toHaveLength(1);
		expect(items[0].stem).toBe('stem a');
	});

	it('matches a substring of contextText for a grammar-cloze question', async () => {
		await insertQuestion({
			format: 'GRAMMAR_CLOZE',
			stem: 'stem a',
			contextText: '明日、友達___空港へ行きます。'
		});
		await insertQuestion({ format: 'STANDARD', stem: 'stem b' });

		const { items } = await listQuestions(db, { q: '空港' });

		expect(items).toHaveLength(1);
		expect(items[0].stem).toBe('stem a');
	});

	it('is case-insensitive for latin text', async () => {
		await insertQuestion({ stem: 'What does Konbanwa mean?' });

		const { items } = await listQuestions(db, { q: 'konbanwa' });

		expect(items).toHaveLength(1);
	});

	it('returns everything when the search term is blank or omitted', async () => {
		await insertQuestion({ stem: 'a' });
		await insertQuestion({ stem: 'b' });

		expect((await listQuestions(db, { q: '' })).items).toHaveLength(2);
		expect((await listQuestions(db)).items).toHaveLength(2);
	});

	it('combines with the existing level/section/status/format filters', async () => {
		await insertQuestion({ stem: 'matching stem', level: 'N4', status: 'PUBLISHED' });
		await insertQuestion({ stem: 'matching stem', level: 'N3', status: 'PUBLISHED' });

		const { items } = await listQuestions(db, { q: 'matching', level: 'N4' });

		expect(items).toHaveLength(1);
		expect(items[0].level).toBe('N4');
	});
});

describe('listQuestions media indicators', () => {
	it('reports hasImage/hasAudio from the attached media slots', async () => {
		const [image] = await db
			.insert(mediaAssets)
			.values({
				kind: 'IMAGE',
				r2Key: 'image.png',
				mimeType: 'image/png',
				byteSize: 10,
				altText: 'a red square',
				uploadedBy: adminId
			})
			.returning({ id: mediaAssets.id });
		const [audio] = await db
			.insert(mediaAssets)
			.values({ kind: 'AUDIO', r2Key: 'audio.mp3', mimeType: 'audio/mpeg', byteSize: 10 })
			.returning({ id: mediaAssets.id });

		await insertQuestion({ stem: 'with image', imageMediaId: image.id });
		await insertQuestion({ stem: 'with audio', audioMediaId: audio.id });
		await insertQuestion({ stem: 'with neither' });

		const { items } = await listQuestions(db);
		const byStem = new Map(items.map((item) => [item.stem, item]));

		expect(byStem.get('with image')).toMatchObject({ hasImage: true, hasAudio: false });
		expect(byStem.get('with audio')).toMatchObject({ hasImage: false, hasAudio: true });
		expect(byStem.get('with neither')).toMatchObject({ hasImage: false, hasAudio: false });
	});
});

describe('listQuestions pagination', () => {
	it('preserves filters across pages', async () => {
		for (let i = 0; i < 3; i += 1) {
			await insertQuestion({ stem: `n4 question ${i}`, level: 'N4' });
		}
		await insertQuestion({ stem: 'n3 question', level: 'N3' });

		const firstPage = await listQuestions(db, { level: 'N4', limit: 2, page: 1 });
		const secondPage = await listQuestions(db, { level: 'N4', limit: 2, page: 2 });

		expect(firstPage.total).toBe(3);
		expect(firstPage.items).toHaveLength(2);
		expect(secondPage.items).toHaveLength(1);
		expect([...firstPage.items, ...secondPage.items].every((item) => item.level === 'N4')).toBe(
			true
		);
	});
});
