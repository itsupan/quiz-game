import { describe, expect, it } from 'vitest';

import {
	scoreAttempt,
	type BandConfig,
	type SavedAnswer,
	type ScoringInput,
	type ServedQuestion
} from '$lib/features/quiz/scoring';

/**
 * Served questions are numbered so the correct option for question N is option N0: answering
 * `10` on question 1 is right, anything else is wrong.
 */
function served(overrides: Partial<ServedQuestion>[] = []): ServedQuestion[] {
	return overrides.map((override, index) => ({
		attemptQuestionId: index + 1,
		questionId: index + 1,
		section: 'VOCAB_KANJI',
		points: 1,
		correctOptionId: (index + 1) * 10,
		...override
	}));
}

const answer = (attemptQuestionId: number, selectedOptionId: number | null): SavedAnswer => ({
	attemptQuestionId,
	selectedOptionId
});

const input = (overrides: Partial<ScoringInput> = {}): ScoringInput => ({
	served: served([{}, {}, {}]),
	answers: [],
	bands: [],
	scaledTotalMax: null,
	passMarkTotal: null,
	...overrides
});

/** The seeded N4 shape: three sections feeding two bands, 120 + 60. */
const N4_BANDS: BandConfig[] = [
	{
		code: 'LANGUAGE_KNOWLEDGE_READING',
		label: '言語知識・読解',
		scaledMax: 120,
		passMark: 38,
		sections: ['VOCAB_KANJI', 'GRAMMAR_READING']
	},
	{
		code: 'LISTENING',
		label: '聴解',
		scaledMax: 60,
		passMark: 19,
		sections: ['LISTENING']
	}
];

describe('scoreAttempt', () => {
	it('counts a matching option as correct and anything else as wrong', () => {
		const result = scoreAttempt(input({ answers: [answer(1, 10), answer(2, 99), answer(3, 30)] }));

		expect(result.rawScore).toBe(2);
		expect(result.correctCount).toBe(2);
		expect(result.questionCount).toBe(3);
		expect(result.rawMax).toBe(3);
	});

	it('awards each question its own points rather than one mark apiece', () => {
		const result = scoreAttempt(
			input({
				served: served([{ points: 2 }, { points: 5 }]),
				answers: [answer(1, 10), answer(2, 99)]
			})
		);

		expect(result.rawScore).toBe(2);
		expect(result.rawMax).toBe(7);
	});

	it('scores an explicit skip as wrong but still returns a row for it', () => {
		// The row exists in attempt_answers, so scoring has to stamp it rather than leave
		// is_correct null and make a later reader guess.
		const result = scoreAttempt(input({ answers: [answer(1, null)] }));

		expect(result.answers).toEqual([{ attemptQuestionId: 1, isCorrect: false, pointsEarned: 0 }]);
	});

	it('counts a question that was never answered without inventing an answer row', () => {
		// This is what a timer expiry looks like: two of three questions reached the database.
		const result = scoreAttempt(input({ answers: [answer(1, 10), answer(2, 20)] }));

		expect(result.answers).toHaveLength(2);
		expect(result.questionCount).toBe(3);
		expect(result.rawMax).toBe(3);
		expect(result.rawScore).toBe(2);
	});

	it('ignores an answer for a question this attempt was not served', () => {
		const result = scoreAttempt(input({ served: served([{}]), answers: [answer(99, 990)] }));

		expect(result.answers).toEqual([]);
		expect(result.rawScore).toBe(0);
	});

	it('cannot mark a question with no answer key correct', () => {
		const result = scoreAttempt(
			input({ served: served([{ correctOptionId: null }]), answers: [answer(1, 10)] })
		);

		expect(result.rawScore).toBe(0);
	});

	it('reports raw scores per section in canonical order', () => {
		const result = scoreAttempt(
			input({
				served: served([
					{ section: 'LISTENING' },
					{ section: 'VOCAB_KANJI' },
					{ section: 'GRAMMAR_READING' }
				]),
				answers: [answer(1, 10), answer(2, 20)]
			})
		);

		expect(result.sectionScores.map((score) => score.section)).toEqual([
			'VOCAB_KANJI',
			'GRAMMAR_READING',
			'LISTENING'
		]);
		expect(result.sectionScores).toContainEqual({
			section: 'LISTENING',
			rawScore: 1,
			rawMax: 1,
			correctCount: 1,
			questionCount: 1
		});
	});

	it('omits a section the attempt was never served', () => {
		const result = scoreAttempt(input({ served: served([{ section: 'VOCAB_KANJI' }]) }));

		expect(result.sectionScores).toHaveLength(1);
	});

	describe('scaled bands', () => {
		/** Four questions: three feeding the 120 band, one feeding listening. */
		const examServed = served([
			{ section: 'VOCAB_KANJI' },
			{ section: 'GRAMMAR_READING' },
			{ section: 'GRAMMAR_READING' },
			{ section: 'LISTENING' }
		]);

		it('scales each band linearly from its own raw total', () => {
			// Two of three in the combined band: round(2/3 * 120) = 80. One of one: 60.
			const result = scoreAttempt(
				input({
					served: examServed,
					answers: [answer(1, 10), answer(2, 20), answer(3, 0), answer(4, 40)],
					bands: N4_BANDS
				})
			);

			expect(result.bandScores.map((band) => band.scaledScore)).toEqual([80, 60]);
			expect(result.scaledTotal).toBe(140);
		});

		it('fails the attempt when one band misses its mark, however good the total', () => {
			// Everything in the 120 band right, listening blank: 120 total clears 90, but
			// listening scores 0 against a minimum of 19. That is a fail in the real exam too.
			const result = scoreAttempt(
				input({
					served: examServed,
					answers: [answer(1, 10), answer(2, 20), answer(3, 30), answer(4, null)],
					bands: N4_BANDS,
					passMarkTotal: 90
				})
			);

			expect(result.scaledTotal).toBe(120);
			expect(result.passed).toBe(false);
			expect(result.bandScores.find((band) => band.bandCode === 'LISTENING')?.passed).toBe(false);
		});

		it('passes when every band clears its minimum and the total clears its own', () => {
			const result = scoreAttempt(
				input({
					served: examServed,
					answers: [answer(1, 10), answer(2, 20), answer(3, 30), answer(4, 40)],
					bands: N4_BANDS,
					passMarkTotal: 90
				})
			);

			expect(result.passed).toBe(true);
		});

		it('does not divide by zero when a band was served no questions', () => {
			// An integer column will happily store NaN, so this has to be caught here.
			const result = scoreAttempt(
				input({ served: served([{ section: 'VOCAB_KANJI' }]), bands: N4_BANDS })
			);

			expect(result.bandScores.find((band) => band.bandCode === 'LISTENING')?.scaledScore).toBe(0);
		});

		it('scales the total directly when a quiz is scaled but unbanded', () => {
			const result = scoreAttempt(
				input({ answers: [answer(1, 10), answer(2, 20)], scaledTotalMax: 180 })
			);

			expect(result.scaledTotal).toBe(120);
		});
	});

	describe('pass verdict', () => {
		it('has no verdict when the quiz sets no bar at all', () => {
			// A practice drill does not fail you; saying it did would be a claim it never made.
			expect(scoreAttempt(input({ answers: [answer(1, 0)] })).passed).toBeNull();
		});

		it('judges on the total when the quiz sets only an overall mark', () => {
			const passing = scoreAttempt(
				input({
					answers: [answer(1, 10), answer(2, 20), answer(3, 30)],
					scaledTotalMax: 180,
					passMarkTotal: 90
				})
			);
			const failing = scoreAttempt(
				input({ answers: [answer(1, 0)], scaledTotalMax: 180, passMarkTotal: 90 })
			);

			expect(passing.passed).toBe(true);
			expect(failing.passed).toBe(false);
		});

		it('leaves a band with no pass mark unjudged rather than failing it', () => {
			const result = scoreAttempt(
				input({
					answers: [answer(1, 0)],
					bands: [
						{
							code: 'LANGUAGE_KNOWLEDGE',
							label: '言語知識',
							scaledMax: 60,
							passMark: null,
							sections: ['VOCAB_KANJI']
						}
					]
				})
			);

			expect(result.bandScores[0].passed).toBeNull();
			expect(result.passed).toBeNull();
		});
	});
});
