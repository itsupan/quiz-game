import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	enforceDeadline,
	finalizeAttempt,
	loadAttempt,
	loadResult,
	saveAnswer,
	startAttempt
} from '$lib/features/quiz/attempts.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import {
	attemptAnswers,
	attempts,
	mediaAssets,
	questionOptions,
	questions,
	quizQuestions,
	quizScoringBands,
	quizSections,
	quizzes,
	users
} from '$lib/server/db/schema';
import type { JlptLevel, QuizMode, Section } from '$lib/server/db/schema';

/**
 * Every function under test takes `now` as its last argument, so the clock is never the
 * wall clock in here — expiry and duration are asserted at exact instants instead of by
 * waiting.
 */
const START = new Date('2026-09-12T09:00:00.000Z');
const after = (seconds: number) => new Date(START.getTime() + seconds * 1000);

let db: TestDatabase;
let adminId: number;
let learnerId: number;
let otherLearnerId: number;

beforeEach(async () => {
	db = createTestDatabase().db;

	const [admin] = await db
		.insert(users)
		.values({ email: 'admin@example.com', displayName: '管理者', role: 'ADMIN' })
		.returning({ id: users.id });
	const [learner] = await db
		.insert(users)
		.values({ email: 'learner@example.com', displayName: '学習者' })
		.returning({ id: users.id });
	const [otherLearner] = await db
		.insert(users)
		.values({ email: 'other@example.com', displayName: '別の学習者' })
		.returning({ id: users.id });

	adminId = admin.id;
	learnerId = learner.id;
	otherLearnerId = otherLearner.id;
});

/** One published question with a four-way answer key: option `10` is always correct. */
async function createQuestion(
	db: TestDatabase,
	overrides: { level?: JlptLevel; section?: Section; points?: number } = {}
) {
	const { level = 'N4', section = 'VOCAB_KANJI', points = 1 } = overrides;

	const [question] = await db
		.insert(questions)
		.values({ stem: 'stem', level, section, points, status: 'PUBLISHED', createdBy: adminId })
		.returning({ id: questions.id });

	const [correct] = await db
		.insert(questionOptions)
		.values({ questionId: question.id, body: 'right', isCorrect: true, position: 1 })
		.returning({ id: questionOptions.id });

	await db.insert(questionOptions).values([
		{ questionId: question.id, body: 'wrong 1', isCorrect: false, position: 2 },
		{ questionId: question.id, body: 'wrong 2', isCorrect: false, position: 3 }
	]);

	return { questionId: question.id, correctOptionId: correct.id };
}

type SectionSpec = {
	section: Section;
	timeLimitSeconds?: number;
	questionCount?: number;
	points?: number;
};

/**
 * A FIXED quiz with one question per section unless told otherwise, each question
 * attached in position order. Returns everything a test needs to drive `startAttempt`
 * and check what it served.
 */
async function createFixedQuiz(
	db: TestDatabase,
	options: {
		mode?: QuizMode;
		level?: JlptLevel;
		timeLimitSeconds?: number | null;
		sections: SectionSpec[];
	}
) {
	const { mode = 'FULL_EXAM', level = 'N4', timeLimitSeconds = null, sections } = options;

	const [quiz] = await db
		.insert(quizzes)
		.values({
			title: 'quiz',
			mode,
			level,
			selectionMode: 'FIXED',
			timeLimitSeconds,
			status: 'PUBLISHED',
			createdBy: adminId
		})
		.returning({ id: quizzes.id });

	const questionsBySection: Record<string, { questionId: number; correctOptionId: number }[]> = {};

	for (const [index, spec] of sections.entries()) {
		const [section] = await db
			.insert(quizSections)
			.values({
				quizId: quiz.id,
				section: spec.section,
				position: index + 1,
				timeLimitSeconds: spec.timeLimitSeconds ?? null
			})
			.returning({ id: quizSections.id });

		const created: { questionId: number; correctOptionId: number }[] = [];

		for (let position = 1; position <= (spec.questionCount ?? 1); position++) {
			const question = await createQuestion(db, {
				level,
				section: spec.section,
				points: spec.points
			});

			await db.insert(quizQuestions).values({
				quizId: quiz.id,
				quizSectionId: section.id,
				questionId: question.questionId,
				position
			});

			created.push(question);
		}

		questionsBySection[spec.section] = created;
	}

	return {
		id: quiz.id,
		quizId: quiz.id,
		selectionMode: 'FIXED' as const,
		level,
		timeLimitSeconds,
		sections: await db.select().from(quizSections).where(eq(quizSections.quizId, quiz.id)),
		questionsBySection
	};
}

describe('startAttempt', () => {
	it('serves a fixed quiz in section-then-question position order, with frozen points', async () => {
		const quiz = await createFixedQuiz(db, {
			sections: [
				{ section: 'GRAMMAR_READING', questionCount: 2, points: 3 },
				{ section: 'VOCAB_KANJI', questionCount: 1 }
			]
		});

		const result = await startAttempt(db, quiz, quiz.sections, learnerId, START);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const view = await loadAttempt(db, result.value, learnerId);

		// Position 1 is section 1 (GRAMMAR_READING, added first), not insertion order.
		expect(view?.questions.map((q) => q.section)).toEqual([
			'GRAMMAR_READING',
			'GRAMMAR_READING',
			'VOCAB_KANJI'
		]);
		expect(view?.questions.map((q) => q.points)).toEqual([3, 3, 1]);
	});

	it('freezes pointsOverride rather than the question’s own points', async () => {
		const quiz = await createFixedQuiz(db, {
			sections: [{ section: 'VOCAB_KANJI', points: 1 }]
		});
		const [row] = await db.select().from(quizQuestions);
		await db.update(quizQuestions).set({ pointsOverride: 9 }).where(eq(quizQuestions.id, row.id));

		const result = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!result.ok) throw new Error(result.message);

		const view = await loadAttempt(db, result.value, learnerId);

		expect(view?.questions[0].points).toBe(9);
	});

	it('refuses a fixed quiz with nothing attached', async () => {
		const quiz = await createFixedQuiz(db, { sections: [] });

		const result = await startAttempt(db, quiz, [], learnerId, START);

		expect(result).toEqual({ ok: false, message: 'This quiz has no questions to serve yet.' });
	});

	describe('a random quiz', () => {
		async function createRandomQuiz(
			db: TestDatabase,
			bankSize: number,
			drawCount: number,
			level: JlptLevel = 'N3'
		) {
			const [quiz] = await db
				.insert(quizzes)
				.values({
					title: 'drill',
					mode: 'JLPT_PRACTICE',
					level,
					selectionMode: 'RANDOM',
					status: 'PUBLISHED',
					createdBy: adminId
				})
				.returning({ id: quizzes.id });

			await db
				.insert(quizSections)
				.values({ quizId: quiz.id, section: 'VOCAB_KANJI', position: 1, drawCount });

			for (let i = 0; i < bankSize; i++) {
				await createQuestion(db, { level, section: 'VOCAB_KANJI' });
			}

			return {
				id: quiz.id,
				quizId: quiz.id,
				selectionMode: 'RANDOM' as const,
				level,
				timeLimitSeconds: null,
				sections: await db.select().from(quizSections).where(eq(quizSections.quizId, quiz.id))
			};
		}

		it('draws exactly drawCount questions from the published bank', async () => {
			const quiz = await createRandomQuiz(db, 8, 5);

			const result = await startAttempt(db, quiz, quiz.sections, learnerId, START);
			if (!result.ok) throw new Error(result.message);

			const view = await loadAttempt(db, result.value, learnerId);
			const bank = await db.select({ id: questions.id }).from(questions);
			const bankIds = new Set(bank.map((q) => q.id));

			// Never assert *which* five — order by random() makes identity flaky by design.
			expect(view?.questions).toHaveLength(5);
			expect(new Set(view?.questions.map((q) => q.questionId)).size).toBe(5);
			for (const question of view?.questions ?? []) {
				expect(bankIds.has(question.questionId)).toBe(true);
			}
		});

		it('refuses to start when the bank is thinner than the draw', async () => {
			const quiz = await createRandomQuiz(db, 2, 5);

			const result = await startAttempt(db, quiz, quiz.sections, learnerId, START);

			expect(result.ok).toBe(false);
		});
	});
});

describe('loadAttempt', () => {
	it('returns null for another learner’s attempt, the same as one that does not exist', async () => {
		const quiz = await createFixedQuiz(db, { sections: [{ section: 'VOCAB_KANJI' }] });
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);

		expect(await loadAttempt(db, started.value, otherLearnerId)).toBeNull();
		expect(await loadAttempt(db, 'not-a-real-id', learnerId)).toBeNull();
	});

	it('never carries an answer key or a transcript', async () => {
		const quiz = await createFixedQuiz(db, { sections: [{ section: 'LISTENING' }] });
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);

		const view = await loadAttempt(db, started.value, learnerId);
		const serialized = JSON.stringify(view);

		expect(serialized).not.toMatch(/is_?correct/i);
		expect(serialized).not.toMatch(/transcript/i);
	});
});

describe('saveAnswer', () => {
	async function startFixedAttempt(
		sections: SectionSpec[],
		timeLimitSeconds: number | null = null
	) {
		const quiz = await createFixedQuiz(db, { sections, timeLimitSeconds });
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);

		const view = await loadAttempt(db, started.value, learnerId);
		if (!view) throw new Error('attempt did not load');

		return { publicId: started.value, view };
	}

	it('records a selection', async () => {
		const { view } = await startFixedAttempt([{ section: 'VOCAB_KANJI' }]);
		const question = view.questions[0];

		const result = await saveAnswer(
			db,
			view,
			question.attemptQuestionId,
			question.options[0].id,
			START
		);

		expect(result.ok).toBe(true);
		const [row] = await db.select().from(attemptAnswers);
		expect(row.selectedOptionId).toBe(question.options[0].id);
	});

	it('upserts on a second answer rather than keeping both', async () => {
		const { view } = await startFixedAttempt([{ section: 'VOCAB_KANJI' }]);
		const question = view.questions[0];

		await saveAnswer(db, view, question.attemptQuestionId, question.options[0].id, START);
		await saveAnswer(db, view, question.attemptQuestionId, question.options[1].id, after(1));

		const rows = await db.select().from(attemptAnswers);
		expect(rows).toHaveLength(1);
		expect(rows[0].selectedOptionId).toBe(question.options[1].id);
	});

	it('records an explicit skip as a null selection', async () => {
		const { view } = await startFixedAttempt([{ section: 'VOCAB_KANJI' }]);
		const question = view.questions[0];

		await saveAnswer(db, view, question.attemptQuestionId, null, START);

		const [row] = await db.select().from(attemptAnswers);
		expect(row.selectedOptionId).toBeNull();
	});

	it('refuses an attemptQuestionId that belongs to a different attempt', async () => {
		// The load-bearing check: the unique index on attempt_answers is on
		// attemptQuestionId alone, so an unchecked write here could overwrite another
		// learner's answer outright.
		const first = await startFixedAttempt([{ section: 'VOCAB_KANJI' }]);
		const secondQuiz = await createFixedQuiz(db, { sections: [{ section: 'VOCAB_KANJI' }] });
		const secondStarted = await startAttempt(
			db,
			secondQuiz,
			secondQuiz.sections,
			otherLearnerId,
			START
		);
		if (!secondStarted.ok) throw new Error(secondStarted.message);
		const secondView = await loadAttempt(db, secondStarted.value, otherLearnerId);
		if (!secondView) throw new Error('second attempt did not load');

		const foreignAttemptQuestionId = secondView.questions[0].attemptQuestionId;

		const result = await saveAnswer(db, first.view, foreignAttemptQuestionId, null, START);

		expect(result.ok).toBe(false);
		expect(await db.select().from(attemptAnswers)).toHaveLength(0);
	});

	it('refuses an option that does not belong to the question', async () => {
		const { view } = await startFixedAttempt([{ section: 'VOCAB_KANJI', questionCount: 2 }]);
		const [first, second] = view.questions;

		const result = await saveAnswer(db, view, first.attemptQuestionId, second.options[0].id, START);

		expect(result.ok).toBe(false);
	});

	it('refuses a write once the attempt’s own clock has run out', async () => {
		const { view } = await startFixedAttempt([{ section: 'VOCAB_KANJI' }], 60);
		const question = view.questions[0];

		const result = await saveAnswer(
			db,
			view,
			question.attemptQuestionId,
			question.options[0].id,
			after(60)
		);

		expect(result.ok).toBe(false);
		expect(await db.select().from(attemptAnswers)).toHaveLength(0);
	});

	it('refuses a write to a section whose own clock has run out, before the attempt ends', async () => {
		const { view } = await startFixedAttempt(
			[{ section: 'VOCAB_KANJI', timeLimitSeconds: 30 }, { section: 'LISTENING' }],
			90
		);
		const closedSection = view.questions.find((q) => q.section === 'VOCAB_KANJI')!;

		const result = await saveAnswer(db, view, closedSection.attemptQuestionId, null, after(31));

		expect(result.ok).toBe(false);
		// The attempt overall is still well inside its 90 second limit.
		expect(after(31).getTime()).toBeLessThan(view.attempt.expiresAt!.getTime());
	});
});

describe('enforceDeadline and finalizeAttempt', () => {
	it('leaves an attempt alone before its deadline', async () => {
		const quiz = await createFixedQuiz(db, {
			sections: [{ section: 'VOCAB_KANJI' }],
			timeLimitSeconds: 100
		});
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);
		const view = await loadAttempt(db, started.value, learnerId);
		if (!view) throw new Error('did not load');

		const status = await enforceDeadline(db, view, after(50));

		expect(status).toBe('IN_PROGRESS');
	});

	it('expires an attempt past its deadline and scores what was saved', async () => {
		const quiz = await createFixedQuiz(db, {
			sections: [{ section: 'VOCAB_KANJI', questionCount: 2 }],
			timeLimitSeconds: 100
		});
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);
		const view = await loadAttempt(db, started.value, learnerId);
		if (!view) throw new Error('did not load');

		// Answer the first question correctly before time runs out; the second is never
		// reached, which is exactly what a timer expiry looks like.
		await saveAnswer(
			db,
			view,
			view.questions[0].attemptQuestionId,
			view.questions[0].options[0].id,
			after(10)
		);

		const status = await enforceDeadline(db, view, after(150));

		expect(status).toBe('EXPIRED');
		const [row] = await db.select().from(attempts).where(eq(attempts.id, view.attempt.id));
		expect(row.status).toBe('EXPIRED');
		expect(row.rawScore).toBe(1);
		expect(row.questionCount).toBe(2);
		// Scored as of the deadline, not as of when this was checked.
		expect(row.durationMs).toBe(100_000);
	});

	it('does not re-score an attempt that was already finalized', async () => {
		const quiz = await createFixedQuiz(db, { sections: [{ section: 'VOCAB_KANJI' }] });
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);

		await finalizeAttempt(
			db,
			(await loadAttempt(db, started.value, learnerId))!.attempt.id,
			'SUBMITTED',
			after(5)
		);
		await finalizeAttempt(
			db,
			(await loadAttempt(db, started.value, learnerId))!.attempt.id,
			'SUBMITTED',
			after(999)
		);

		const [row] = await db.select().from(attempts);
		// The second call found nothing IN_PROGRESS to claim, so the first result stands.
		expect(row.durationMs).toBe(5_000);
	});

	it('rolls every score write back when closing the attempt fails, then retries cleanly', async () => {
		const quiz = await createFixedQuiz(db, { sections: [{ section: 'VOCAB_KANJI' }] });
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);
		const view = await loadAttempt(db, started.value, learnerId);
		if (!view) throw new Error('did not load');

		await saveAnswer(
			db,
			view,
			view.questions[0].attemptQuestionId,
			view.questions[0].options[0].id,
			after(1)
		);

		await db.run(
			sql.raw(`
			CREATE TRIGGER fail_attempt_close
			BEFORE UPDATE OF status ON attempts
			WHEN NEW.status != 'IN_PROGRESS'
			BEGIN
				SELECT RAISE(ABORT, 'forced finalization failure');
			END
		`)
		);

		await expect(finalizeAttempt(db, view.attempt.id, 'SUBMITTED', after(5))).rejects.toThrow(
			'forced finalization failure'
		);

		let [attempt] = await db.select().from(attempts).where(eq(attempts.id, view.attempt.id));
		let [answer] = await db.select().from(attemptAnswers);
		expect(attempt.status).toBe('IN_PROGRESS');
		expect(answer.isCorrect).toBeNull();
		expect(attempt.rawScore).toBeNull();

		await db.run(sql.raw('DROP TRIGGER fail_attempt_close'));
		await finalizeAttempt(db, view.attempt.id, 'SUBMITTED', after(5));

		[attempt] = await db.select().from(attempts).where(eq(attempts.id, view.attempt.id));
		[answer] = await db.select().from(attemptAnswers);
		expect(attempt.status).toBe('SUBMITTED');
		expect(attempt.rawScore).toBe(1);
		expect(answer.isCorrect).toBe(true);
	});

	it('scores per section and per band, and fails the attempt when a band misses its mark', async () => {
		const quiz = await createFixedQuiz(db, {
			mode: 'FULL_EXAM',
			timeLimitSeconds: 200,
			sections: [{ section: 'VOCAB_KANJI' }, { section: 'LISTENING' }]
		});
		await db.update(quizzes).set({ passMarkTotal: 50 }).where(eq(quizzes.id, quiz.quizId));
		const [languageBand] = await db
			.insert(quizScoringBands)
			.values({
				quizId: quiz.quizId,
				code: 'LANGUAGE_KNOWLEDGE',
				label: '言語知識',
				position: 1,
				scaledMax: 60,
				passMark: 19
			})
			.returning({ id: quizScoringBands.id });
		const [listeningBand] = await db
			.insert(quizScoringBands)
			.values({
				quizId: quiz.quizId,
				code: 'LISTENING',
				label: '聴解',
				position: 2,
				scaledMax: 60,
				passMark: 19
			})
			.returning({ id: quizScoringBands.id });
		await db
			.update(quizSections)
			.set({ scoringBandId: languageBand.id })
			.where(eq(quizSections.section, 'VOCAB_KANJI'));
		await db
			.update(quizSections)
			.set({ scoringBandId: listeningBand.id })
			.where(eq(quizSections.section, 'LISTENING'));

		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);
		const view = await loadAttempt(db, started.value, learnerId);
		if (!view) throw new Error('did not load');

		// Vocab right, listening blank.
		const vocab = view.questions.find((q) => q.section === 'VOCAB_KANJI')!;
		await saveAnswer(db, view, vocab.attemptQuestionId, vocab.options[0].id, START);

		await finalizeAttempt(db, view.attempt.id, 'SUBMITTED', after(10));

		const [row] = await db.select().from(attempts).where(eq(attempts.id, view.attempt.id));
		expect(row.scaledTotal).toBe(60); // 60 from vocab, 0 from listening
		expect(row.passed).toBe(false); // listening never cleared its own 19 point mark

		const result = await loadResult(db, started.value, learnerId);
		expect(result?.bandScores.map((b) => b.bandCode)).toEqual(['LANGUAGE_KNOWLEDGE', 'LISTENING']);
		expect(result?.bandScores.find((b) => b.bandCode === 'LISTENING')?.passed).toBe(false);
	});
});

describe('loadResult', () => {
	it('is unreachable while an attempt is still in progress', async () => {
		const quiz = await createFixedQuiz(db, { sections: [{ section: 'VOCAB_KANJI' }] });
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);

		expect(await loadResult(db, started.value, learnerId)).toBeNull();
	});

	it('reveals the correct option once the attempt is finalized', async () => {
		const quiz = await createFixedQuiz(db, { sections: [{ section: 'VOCAB_KANJI' }] });
		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);
		const view = await loadAttempt(db, started.value, learnerId);
		if (!view) throw new Error('did not load');

		await finalizeAttempt(db, view.attempt.id, 'SUBMITTED', after(5));

		const result = await loadResult(db, started.value, learnerId);
		const question = result?.questions[0];

		expect(question?.correctOptionId).not.toBeNull();
		expect(question?.isCorrect).toBe(false);
	});

	it('shows a listening question’s transcript, unlike the in-progress attempt view', async () => {
		const quiz = await createFixedQuiz(db, { sections: [{ section: 'LISTENING' }] });
		const question = quiz.questionsBySection.LISTENING[0];

		const [asset] = await db
			.insert(mediaAssets)
			.values({
				kind: 'AUDIO',
				r2Key: 'fixture.mp3',
				mimeType: 'audio/mpeg',
				byteSize: 1,
				transcript: 'これはテストの文字起こしです。',
				uploadedBy: adminId
			})
			.returning({ id: mediaAssets.id });
		await db
			.update(questions)
			.set({ audioMediaId: asset.id })
			.where(eq(questions.id, question.questionId));

		const started = await startAttempt(db, quiz, quiz.sections, learnerId, START);
		if (!started.ok) throw new Error(started.message);

		const inProgress = await loadAttempt(db, started.value, learnerId);
		expect(inProgress?.questions[0].audio?.transcript).toBeNull();

		await finalizeAttempt(db, inProgress!.attempt.id, 'SUBMITTED', after(1));

		const result = await loadResult(db, started.value, learnerId);
		expect(result?.questions[0].audio?.transcript).toBe('これはテストの文字起こしです。');
	});
});
