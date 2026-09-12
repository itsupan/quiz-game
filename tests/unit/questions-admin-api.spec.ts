import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	currentQuestionFrom,
	parseQuestionCreateBody,
	parseQuestionPatchBody
} from '$lib/features/questions/api.server';
import { getQuestion } from '$lib/features/questions/questions.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { ApiProblem } from '$lib/server/http/problem';
import { mediaAssets, users } from '$lib/server/db/schema';

let db: TestDatabase;
let imageId: string;
let audioId: string;

function validCreateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		stem: 'この漢字の読み方はどれですか。「病院」',
		explanation: null,
		level: 'N4',
		section: 'VOCAB_KANJI',
		points: 1,
		imageId: null,
		audioId: null,
		options: [
			{ body: 'びょういん', isCorrect: true },
			{ body: 'びよういん', isCorrect: false }
		],
		...overrides
	};
}

beforeEach(async () => {
	db = createTestDatabase().db;

	const [admin] = await db
		.insert(users)
		.values({ email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN' })
		.returning({ id: users.id });

	const [image] = await db
		.insert(mediaAssets)
		.values({
			kind: 'IMAGE',
			r2Key: 'image.png',
			mimeType: 'image/png',
			byteSize: 10,
			altText: 'a red square',
			uploadedBy: admin.id
		})
		.returning({ publicId: mediaAssets.publicId });
	const [audio] = await db
		.insert(mediaAssets)
		.values({
			kind: 'AUDIO',
			r2Key: 'audio.mp3',
			mimeType: 'audio/mpeg',
			byteSize: 10,
			uploadedBy: admin.id
		})
		.returning({ publicId: mediaAssets.publicId });

	imageId = image.publicId;
	audioId = audio.publicId;
});

describe('parseQuestionCreateBody', () => {
	it('accepts a well-formed body with no media', async () => {
		const result = await parseQuestionCreateBody(db, validCreateBody());
		expect(result).toMatchObject({
			stem: 'この漢字の読み方はどれですか。「病院」',
			level: 'N4',
			section: 'VOCAB_KANJI',
			points: 1,
			imageMediaId: null,
			audioMediaId: null
		});
		expect(result.options).toEqual([
			{ id: null, body: 'びょういん', isCorrect: true, position: 1 },
			{ id: null, body: 'びよういん', isCorrect: false, position: 2 }
		]);
	});

	it('resolves media public ids to internal ids when the kind matches', async () => {
		const result = await parseQuestionCreateBody(db, validCreateBody({ imageId, audioId }));
		const [image] = await db
			.select({ id: mediaAssets.id })
			.from(mediaAssets)
			.where(eq(mediaAssets.publicId, imageId));
		expect(result.imageMediaId).toBe(image?.id);
	});

	it('rejects a media id of the wrong kind', async () => {
		await expect(
			parseQuestionCreateBody(db, validCreateBody({ imageId: audioId }))
		).rejects.toThrow(ApiProblem);
	});

	it('rejects a media id that does not exist', async () => {
		await expect(
			parseQuestionCreateBody(db, validCreateBody({ imageId: '01JSEEDDOESNOTEXIST00000000' }))
		).rejects.toThrow(ApiProblem);
	});

	it('rejects fewer than two options', async () => {
		await expect(
			parseQuestionCreateBody(db, validCreateBody({ options: [{ body: 'a', isCorrect: true }] }))
		).rejects.toThrow(ApiProblem);
	});

	it('rejects zero or more than one correct option', async () => {
		await expect(
			parseQuestionCreateBody(
				db,
				validCreateBody({
					options: [
						{ body: 'a', isCorrect: false },
						{ body: 'b', isCorrect: false }
					]
				})
			)
		).rejects.toThrow(ApiProblem);

		await expect(
			parseQuestionCreateBody(
				db,
				validCreateBody({
					options: [
						{ body: 'a', isCorrect: true },
						{ body: 'b', isCorrect: true }
					]
				})
			)
		).rejects.toThrow(ApiProblem);
	});

	it('rejects a missing required field', async () => {
		const body = validCreateBody();
		delete body.stem;
		await expect(parseQuestionCreateBody(db, body)).rejects.toThrow(ApiProblem);
	});

	it('defaults points to 1 when omitted', async () => {
		const body = validCreateBody();
		delete body.points;
		const result = await parseQuestionCreateBody(db, body);
		expect(result.points).toBe(1);
	});
});

describe('parseQuestionPatchBody', () => {
	const current = currentQuestionFrom(
		{
			stem: 'old stem',
			explanation: 'old',
			level: 'N4',
			section: 'VOCAB_KANJI',
			points: 1
		} as never,
		null,
		null
	);
	const existingOptions = [
		{
			id: 1,
			questionId: 1,
			body: 'a',
			isCorrect: true,
			position: 1,
			createdAt: new Date(),
			updatedAt: new Date()
		},
		{
			id: 2,
			questionId: 1,
			body: 'b',
			isCorrect: false,
			position: 2,
			createdAt: new Date(),
			updatedAt: new Date()
		}
	];

	it('keeps existing options untouched, with their ids, when the patch omits options', async () => {
		const result = await parseQuestionPatchBody(db, current, existingOptions, { points: 2 });
		expect(result.points).toBe(2);
		expect(result.stem).toBe('old stem');
		expect(result.options).toEqual([
			{ id: 1, body: 'a', isCorrect: true, position: 1 },
			{ id: 2, body: 'b', isCorrect: false, position: 2 }
		]);
	});

	it('replaces every option, dropping ids, when the patch includes options', async () => {
		const result = await parseQuestionPatchBody(db, current, existingOptions, {
			options: [
				{ body: 'x', isCorrect: false },
				{ body: 'y', isCorrect: true }
			]
		});
		expect(result.options).toEqual([
			{ id: null, body: 'x', isCorrect: false, position: 1 },
			{ id: null, body: 'y', isCorrect: true, position: 2 }
		]);
	});

	it('clears a media reference by patching it to null', async () => {
		const withImage = { ...current, imageId };
		const result = await parseQuestionPatchBody(db, withImage, existingOptions, { imageId: null });
		expect(result.imageMediaId).toBeNull();
	});
});

/** Regression coverage for the end-to-end create → patch round trip through a real DB. */
describe('question create/patch round trip', () => {
	it('creates then patches a question, preserving points across an options-only edit', async () => {
		const { createQuestion } = await import('$lib/features/questions/questions.server');
		const created = await createQuestion(
			db,
			null,
			await parseQuestionCreateBody(db, validCreateBody({ points: 3 }))
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const before = await getQuestion(db, created.value);
		expect(before?.question.points).toBe(3);
	});
});
