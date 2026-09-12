import { beforeEach, describe, expect, it } from 'vitest';

import {
	currentQuestionFrom,
	parseQuestionCreateBody,
	parseQuestionPatchBody
} from '$lib/features/questions/api.server';
import { questionPublishBlockers } from '$lib/features/questions/validation';
import { createGroup } from '$lib/features/questions/groups.server';
import type { GroupInput } from '$lib/features/questions/groups-validation';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { ApiProblem } from '$lib/server/http/problem';
import { users } from '$lib/server/db/schema';

let db: TestDatabase;
let adminId: number;

function options() {
	return [
		{ body: 'a', isCorrect: true },
		{ body: 'b', isCorrect: false }
	];
}

function baseGroupInput(overrides: Partial<GroupInput> = {}): GroupInput {
	return {
		level: 'N3',
		section: 'GRAMMAR_READING',
		format: 'READING_PASSAGE',
		title: null,
		body: 'passage text',
		instruction: null,
		bodyTranslation: null,
		exampleText: null,
		exampleTransliteration: null,
		exampleTranslation: null,
		imageMediaId: null,
		audioMediaId: null,
		...overrides
	};
}

beforeEach(async () => {
	db = createTestDatabase().db;
	const [admin] = await db
		.insert(users)
		.values({ email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN' })
		.returning({ id: users.id });
	adminId = admin.id;
});

describe('VOCABULARY_MEANING / KANJI_READING', () => {
	it('requires a non-empty focusText', async () => {
		await expect(
			parseQuestionCreateBody(db, {
				stem: '意味は？',
				level: 'N4',
				section: 'VOCAB_KANJI',
				format: 'VOCABULARY_MEANING',
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('accepts a focusText with an optional reading', async () => {
		const result = await parseQuestionCreateBody(db, {
			stem: '意味は？',
			level: 'N4',
			section: 'VOCAB_KANJI',
			format: 'KANJI_READING',
			focusText: '病院',
			focusReading: 'びょういん',
			options: options()
		});
		expect(result.focusText).toBe('病院');
		expect(result.focusReading).toBe('びょういん');
	});
});

describe('GRAMMAR_CLOZE', () => {
	it('requires a non-empty contextText', async () => {
		await expect(
			parseQuestionCreateBody(db, {
				stem: '空欄',
				level: 'N4',
				section: 'GRAMMAR_READING',
				format: 'GRAMMAR_CLOZE',
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('rejects a contextText with no blank token', async () => {
		await expect(
			parseQuestionCreateBody(db, {
				stem: '空欄',
				level: 'N4',
				section: 'GRAMMAR_READING',
				format: 'GRAMMAR_CLOZE',
				contextText: '私は毎日行きます。',
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('rejects a contextText with a malformed blank run', async () => {
		await expect(
			parseQuestionCreateBody(db, {
				stem: '空欄',
				level: 'N4',
				section: 'GRAMMAR_READING',
				format: 'GRAMMAR_CLOZE',
				contextText: '私は____行きます。',
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('rejects a contextText with two separate blanks', async () => {
		await expect(
			parseQuestionCreateBody(db, {
				stem: '空欄',
				level: 'N4',
				section: 'GRAMMAR_READING',
				format: 'GRAMMAR_CLOZE',
				contextText: '私は___毎日___行きます。',
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('accepts a contextText with exactly one blank', async () => {
		const result = await parseQuestionCreateBody(db, {
			stem: '空欄',
			level: 'N4',
			section: 'GRAMMAR_READING',
			format: 'GRAMMAR_CLOZE',
			contextText: '私は毎日___行きます。',
			options: options()
		});
		expect(result.contextText).toBe('私は毎日___行きます。');
	});
});

describe('groupId compatibility', () => {
	it('rejects groupId for a STANDARD question', async () => {
		const group = await createGroup(db, adminId, baseGroupInput());
		await expect(
			parseQuestionCreateBody(db, {
				stem: 'stem',
				level: 'N3',
				section: 'GRAMMAR_READING',
				format: 'STANDARD',
				groupId: group.publicId,
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('requires a groupId for READING_COMPREHENSION', async () => {
		await expect(
			parseQuestionCreateBody(db, {
				stem: 'stem',
				level: 'N3',
				section: 'GRAMMAR_READING',
				format: 'READING_COMPREHENSION',
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('rejects a READING_COMPREHENSION question attached to a LISTENING_CLIP group', async () => {
		const group = await createGroup(
			db,
			adminId,
			baseGroupInput({ format: 'LISTENING_CLIP', body: null })
		);
		await expect(
			parseQuestionCreateBody(db, {
				stem: 'stem',
				level: 'N3',
				section: 'GRAMMAR_READING',
				format: 'READING_COMPREHENSION',
				groupId: group.publicId,
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('rejects a group whose level/section does not match the question', async () => {
		const group = await createGroup(db, adminId, baseGroupInput({ level: 'N2' }));
		await expect(
			parseQuestionCreateBody(db, {
				stem: 'stem',
				level: 'N3',
				section: 'GRAMMAR_READING',
				format: 'READING_COMPREHENSION',
				groupId: group.publicId,
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});

	it('accepts a matching READING_COMPREHENSION + READING_PASSAGE pair', async () => {
		const group = await createGroup(db, adminId, baseGroupInput());
		const result = await parseQuestionCreateBody(db, {
			stem: 'stem',
			level: 'N3',
			section: 'GRAMMAR_READING',
			format: 'READING_COMPREHENSION',
			groupId: group.publicId,
			options: options()
		});
		expect(result.groupId).toBe(group.id);
	});

	it('lets a GRAMMAR_CLOZE question optionally attach a CONCEPT_REVIEW group', async () => {
		const group = await createGroup(
			db,
			adminId,
			baseGroupInput({
				format: 'CONCEPT_REVIEW',
				level: 'N4',
				section: 'GRAMMAR_READING',
				body: 'explanation',
				exampleText: 'example'
			})
		);
		const result = await parseQuestionCreateBody(db, {
			stem: 'stem',
			level: 'N4',
			section: 'GRAMMAR_READING',
			format: 'GRAMMAR_CLOZE',
			contextText: '私は___行きます。',
			groupId: group.publicId,
			options: options()
		});
		expect(result.groupId).toBe(group.id);
	});

	it('rejects a groupPosition without a groupId', async () => {
		await expect(
			parseQuestionCreateBody(db, {
				stem: 'stem',
				level: 'N3',
				section: 'GRAMMAR_READING',
				format: 'STANDARD',
				groupPosition: 1,
				options: options()
			})
		).rejects.toThrow(ApiProblem);
	});
});

describe('parseQuestionPatchBody group/omit-vs-null semantics', () => {
	it('does not detach an attached group when groupId is omitted from the patch', async () => {
		const group = await createGroup(db, adminId, baseGroupInput());
		const current = currentQuestionFrom(
			{
				stem: 'stem',
				explanation: null,
				level: 'N3',
				section: 'GRAMMAR_READING',
				format: 'READING_COMPREHENSION',
				promptTranslation: null,
				focusText: null,
				focusReading: null,
				contextText: null,
				contextTransliteration: null,
				points: 1,
				groupPosition: 1
			} as never,
			null,
			null,
			{ publicId: group.publicId } as never
		);

		const result = await parseQuestionPatchBody(db, current, [], { points: 2 });
		expect(result.groupId).toBe(group.id);
		expect(result.points).toBe(2);
	});

	it('detaches the group on an explicit groupId: null, when the resulting format allows it', async () => {
		const group = await createGroup(db, adminId, baseGroupInput());
		const current = currentQuestionFrom(
			{
				stem: 'stem',
				explanation: null,
				level: 'N3',
				section: 'GRAMMAR_READING',
				format: 'READING_COMPREHENSION',
				promptTranslation: null,
				focusText: null,
				focusReading: null,
				contextText: null,
				contextTransliteration: null,
				points: 1,
				groupPosition: 1
			} as never,
			null,
			null,
			{ publicId: group.publicId } as never
		);

		const result = await parseQuestionPatchBody(db, current, [], {
			format: 'STANDARD',
			groupId: null
		});
		expect(result.groupId).toBeNull();
	});
});

describe('questionPublishBlockers with an attached group', () => {
	it('blocks publication when the attached group is not yet published', () => {
		const blockers = questionPublishBlockers(
			{ stem: 'stem', format: 'READING_COMPREHENSION', focusText: null, contextText: null },
			{ image: null, audio: null },
			[{ isCorrect: true }, { isCorrect: false }],
			{ status: 'DRAFT', blockers: [] }
		);
		expect(blockers).toContain(
			'The attached question group must be published before this question can be.'
		);
	});

	it('surfaces the attached group’s own content blockers', () => {
		const blockers = questionPublishBlockers(
			{ stem: 'stem', format: 'READING_COMPREHENSION', focusText: null, contextText: null },
			{ image: null, audio: null },
			[{ isCorrect: true }, { isCorrect: false }],
			{ status: 'PUBLISHED', blockers: ['A reading passage group needs non-empty body text.'] }
		);
		expect(blockers.some((message) => message.includes('not ready'))).toBe(true);
	});

	it('requires an attached group at all for READING_COMPREHENSION', () => {
		const blockers = questionPublishBlockers(
			{ stem: 'stem', format: 'READING_COMPREHENSION', focusText: null, contextText: null },
			{ image: null, audio: null },
			[{ isCorrect: true }, { isCorrect: false }],
			null
		);
		expect(blockers).toContain(
			'READING_COMPREHENSION requires an attached, compatible question group.'
		);
	});
});
