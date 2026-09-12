import { describe, expect, it } from 'vitest';

import { ApiProblem } from '$lib/server/http/problem';
import {
	parseQuizCreateBody,
	parseQuizPatchBody,
	parseQuizSectionCreateBody,
	parseQuizSectionPatchBody
} from '$lib/features/quiz/admin/api-validation';
import type { QuizInput, QuizSectionInput } from '$lib/features/quiz/admin/validation';

function validQuizBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		title: 'JLPT N4 模擬本試験',
		description: null,
		mode: 'FULL_EXAM',
		level: 'N4',
		selectionMode: 'FIXED',
		timeLimitSeconds: 6900,
		...overrides
	};
}

const currentQuiz: QuizInput = {
	title: 'Existing quiz',
	description: 'desc',
	mode: 'JLPT_PRACTICE',
	level: 'N3',
	selectionMode: 'RANDOM',
	timeLimitSeconds: null
};

describe('parseQuizCreateBody', () => {
	it('accepts a complete, well-formed body', () => {
		expect(parseQuizCreateBody(validQuizBody())).toEqual({
			title: 'JLPT N4 模擬本試験',
			description: null,
			mode: 'FULL_EXAM',
			level: 'N4',
			selectionMode: 'FIXED',
			timeLimitSeconds: 6900
		});
	});

	it('defaults timeLimitSeconds and description to null when omitted for an untimed mode', () => {
		const body = {
			title: 'N4 practice',
			mode: 'JLPT_PRACTICE',
			level: 'N4',
			selectionMode: 'FIXED'
		};
		expect(parseQuizCreateBody(body)).toMatchObject({ description: null, timeLimitSeconds: null });
	});

	it('rejects a missing required field', () => {
		const body = validQuizBody();
		delete body.title;
		expect(() => parseQuizCreateBody(body)).toThrow(ApiProblem);
		try {
			parseQuizCreateBody(body);
		} catch (cause) {
			expect(cause).toBeInstanceOf(ApiProblem);
			expect((cause as ApiProblem).status).toBe(422);
			expect((cause as ApiProblem).errors?.some((e) => e.field === 'title')).toBe(true);
		}
	});

	it('rejects an enum field outside the schema', () => {
		expect(() => parseQuizCreateBody(validQuizBody({ level: 'N0' }))).toThrow(ApiProblem);
	});

	it('rejects a timed mode with no time limit', () => {
		expect(() =>
			parseQuizCreateBody(validQuizBody({ mode: 'MOCK_TEST', timeLimitSeconds: null }))
		).toThrow(/time limit/i);
	});

	it('allows an untimed practice quiz', () => {
		const result = parseQuizCreateBody(
			validQuizBody({ mode: 'JLPT_PRACTICE', timeLimitSeconds: null })
		);
		expect(result.timeLimitSeconds).toBeNull();
	});

	it('rejects a non-positive time limit', () => {
		expect(() => parseQuizCreateBody(validQuizBody({ timeLimitSeconds: 0 }))).toThrow(ApiProblem);
	});
});

describe('parseQuizPatchBody', () => {
	it('merges a partial patch onto the current quiz', () => {
		const result = parseQuizPatchBody(currentQuiz, { title: 'New title' });
		expect(result).toEqual({ ...currentQuiz, title: 'New title' });
	});

	it('rejects a patch that would leave a timed mode with no time limit', () => {
		expect(() => parseQuizPatchBody(currentQuiz, { mode: 'MOCK_TEST' })).toThrow(/time limit/i);
	});

	it('accepts a patch that sets both mode and a time limit together', () => {
		const result = parseQuizPatchBody(currentQuiz, { mode: 'MOCK_TEST', timeLimitSeconds: 3600 });
		expect(result.mode).toBe('MOCK_TEST');
		expect(result.timeLimitSeconds).toBe(3600);
	});

	it('an empty patch is a no-op', () => {
		expect(parseQuizPatchBody(currentQuiz, {})).toEqual(currentQuiz);
	});

	it('rejects an unknown enum value', () => {
		expect(() => parseQuizPatchBody(currentQuiz, { selectionMode: 'SHUFFLED' })).toThrow(
			ApiProblem
		);
	});
});

describe('parseQuizSectionCreateBody', () => {
	it('accepts a fixed-quiz section without a draw count', () => {
		const result = parseQuizSectionCreateBody(
			{ section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: 1500, drawCount: null },
			'FIXED'
		);
		expect(result).toEqual({
			section: 'VOCAB_KANJI',
			position: 1,
			timeLimitSeconds: 1500,
			drawCount: null
		});
	});

	it('requires a draw count on a random quiz', () => {
		expect(() =>
			parseQuizSectionCreateBody({ section: 'VOCAB_KANJI', position: 1 }, 'RANDOM')
		).toThrow(/random/i);
	});

	it('rejects a draw count on a fixed quiz', () => {
		expect(() =>
			parseQuizSectionCreateBody({ section: 'VOCAB_KANJI', position: 1, drawCount: 5 }, 'FIXED')
		).toThrow(/fixed/i);
	});

	it('rejects a missing required field', () => {
		expect(() => parseQuizSectionCreateBody({ position: 1 }, 'FIXED')).toThrow(ApiProblem);
	});
});

describe('parseQuizSectionPatchBody', () => {
	const current: Pick<QuizSectionInput, 'position' | 'timeLimitSeconds' | 'drawCount'> = {
		position: 1,
		timeLimitSeconds: 1500,
		drawCount: null
	};

	it('rejects a body that tries to change the section itself', () => {
		expect(() =>
			parseQuizSectionPatchBody(current, { section: 'LISTENING' }, 'VOCAB_KANJI', 'FIXED')
		).toThrow(ApiProblem);
	});

	it('merges a partial patch onto the current section', () => {
		const result = parseQuizSectionPatchBody(current, { position: 2 }, 'VOCAB_KANJI', 'FIXED');
		expect(result).toEqual({
			section: 'VOCAB_KANJI',
			position: 2,
			timeLimitSeconds: 1500,
			drawCount: null
		});
	});

	it('re-runs the draw count rule against the merged result', () => {
		expect(() => parseQuizSectionPatchBody(current, {}, 'VOCAB_KANJI', 'RANDOM')).toThrow(
			/random/i
		);
	});
});
