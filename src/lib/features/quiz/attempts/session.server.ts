import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';

import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import {
	attemptAnswers,
	attemptQuestionGroups,
	attemptQuestionOptions,
	attemptQuestions,
	attempts,
	attemptSections,
	quizzes
} from '$lib/server/db/schema';
import type { AnswerVerdict } from '../api/types';
import { isPracticeMode } from '../modes';
import { isExpired, sectionDeadlines, sectionOpen } from '../timing';
import { frozenOptionsQuery, groupFrozenOptions } from './questions.server';
import type { AttemptView } from './types.server';

function attemptGroupsQuery(db: Database, attemptId: number) {
	return db
		.select({
			publicId: attemptQuestionGroups.publicId,
			format: attemptQuestionGroups.format,
			title: attemptQuestionGroups.title,
			instruction: attemptQuestionGroups.instruction,
			passageText: attemptQuestionGroups.passageText,
			bodyTranslation: attemptQuestionGroups.bodyTranslation,
			exampleText: attemptQuestionGroups.exampleText,
			exampleTransliteration: attemptQuestionGroups.exampleTransliteration,
			exampleTranslation: attemptQuestionGroups.exampleTranslation,
			imagePublicId: attemptQuestionGroups.imagePublicId,
			imageMimeType: attemptQuestionGroups.imageMimeType,
			imageWidth: attemptQuestionGroups.imageWidth,
			imageHeight: attemptQuestionGroups.imageHeight,
			imageAltText: attemptQuestionGroups.imageAltText,
			audioPublicId: attemptQuestionGroups.audioPublicId,
			audioMimeType: attemptQuestionGroups.audioMimeType,
			audioDurationMs: attemptQuestionGroups.audioDurationMs
		})
		.from(attemptQuestionGroups)
		.where(eq(attemptQuestionGroups.attemptId, attemptId));
}

function mapAttemptGroups(
	rows: Awaited<ReturnType<typeof attemptGroupsQuery>>,
	showStudyAidsDuringAttempt: boolean
) {
	return new Map(
		rows
			.filter((entry) => showStudyAidsDuringAttempt || entry.format !== 'CONCEPT_REVIEW')
			.map((entry) => [
				entry.publicId,
				{
					publicId: entry.publicId,
					format: entry.format,
					title: entry.title,
					instruction: entry.instruction,
					passageText: entry.passageText,
					bodyTranslation: showStudyAidsDuringAttempt ? entry.bodyTranslation : null,
					exampleText: showStudyAidsDuringAttempt ? entry.exampleText : null,
					exampleTransliteration: showStudyAidsDuringAttempt ? entry.exampleTransliteration : null,
					exampleTranslation: showStudyAidsDuringAttempt ? entry.exampleTranslation : null,
					image: entry.imagePublicId
						? {
								publicId: entry.imagePublicId,
								mimeType: entry.imageMimeType,
								width: entry.imageWidth,
								height: entry.imageHeight,
								altText: entry.imageAltText
							}
						: null,
					audio: entry.audioPublicId
						? {
								publicId: entry.audioPublicId,
								mimeType: entry.audioMimeType,
								durationMs: entry.audioDurationMs
							}
						: null
				}
			])
	);
}

export async function loadAttempt(
	db: Database,
	publicId: string,
	userId: number
): Promise<AttemptView | null> {
	const [row] = await db
		.select({
			attemptId: attempts.id,
			attemptPublicId: attempts.publicId,
			userId: attempts.userId,
			status: attempts.status,
			startedAt: attempts.startedAt,
			expiresAt: attempts.expiresAt,
			showStudyAidsDuringAttempt: attempts.showStudyAidsDuringAttempt,
			currentCombo: attempts.currentCombo,
			bestCombo: attempts.bestCombo,
			quizId: quizzes.id,
			quizPublicId: quizzes.publicId,
			title: quizzes.title,
			mode: quizzes.mode,
			level: quizzes.level,
			timeLimitSeconds: quizzes.timeLimitSeconds
		})
		.from(attempts)
		.innerJoin(quizzes, eq(quizzes.id, attempts.quizId))
		.where(and(eq(attempts.publicId, publicId), eq(attempts.userId, userId)));

	if (!row) return null;

	// One round trip for everything hanging off the attempt row. D1 is a network hop away
	// from the Worker, and this runs on every question view and every answer, so four
	// sequential awaits here were a large share of a tap's latency.
	const [sections, served, optionRows, groupRows] = await db.batch([
		// Frozen at start time: what this attempt's sections actually looked like then, not
		// whatever `quiz_sections` says now.
		db
			.select({
				section: attemptSections.section,
				position: attemptSections.position,
				timeLimitSeconds: attemptSections.timeLimitSeconds
			})
			.from(attemptSections)
			.where(eq(attemptSections.attemptId, row.attemptId)),
		db
			.select({
				attemptQuestionId: attemptQuestions.id,
				questionId: attemptQuestions.questionId,
				section: attemptQuestions.section,
				groupPublicId: attemptQuestions.groupPublicId,
				position: attemptQuestions.position,
				points: attemptQuestions.points,
				format: attemptQuestions.format,
				stem: attemptQuestions.stem,
				promptTranslation: attemptQuestions.promptTranslation,
				focusText: attemptQuestions.focusText,
				focusReading: attemptQuestions.focusReading,
				contextText: attemptQuestions.contextText,
				contextTransliteration: attemptQuestions.contextTransliteration,
				imagePublicId: attemptQuestions.imagePublicId,
				imageMimeType: attemptQuestions.imageMimeType,
				imageWidth: attemptQuestions.imageWidth,
				imageHeight: attemptQuestions.imageHeight,
				imageAltText: attemptQuestions.imageAltText,
				audioPublicId: attemptQuestions.audioPublicId,
				audioMimeType: attemptQuestions.audioMimeType,
				audioDurationMs: attemptQuestions.audioDurationMs,
				selectedOptionId: attemptAnswers.selectedOptionId
			})
			.from(attemptQuestions)
			.leftJoin(attemptAnswers, eq(attemptAnswers.attemptQuestionId, attemptQuestions.id))
			.where(eq(attemptQuestions.attemptId, row.attemptId))
			.orderBy(attemptQuestions.position),
		frozenOptionsQuery(db, row.attemptId),
		attemptGroupsQuery(db, row.attemptId)
	]);

	const options = groupFrozenOptions(optionRows);
	const groups = mapAttemptGroups(groupRows, row.showStudyAidsDuringAttempt);

	return {
		attempt: {
			id: row.attemptId,
			publicId: row.attemptPublicId,
			userId: row.userId,
			status: row.status,
			startedAt: row.startedAt,
			expiresAt: row.expiresAt,
			showStudyAidsDuringAttempt: row.showStudyAidsDuringAttempt,
			currentCombo: row.currentCombo,
			bestCombo: row.bestCombo
		},
		quiz: {
			id: row.quizId,
			publicId: row.quizPublicId,
			title: row.title,
			mode: row.mode,
			level: row.level,
			timeLimitSeconds: row.timeLimitSeconds
		},
		sectionDeadlines: sectionDeadlines(row.startedAt, row.expiresAt, sections),
		questions: served.map((entry) => ({
			attemptQuestionId: entry.attemptQuestionId,
			questionId: entry.questionId,
			section: entry.section,
			position: entry.position,
			points: entry.points,
			format: entry.format,
			stem: entry.stem ?? '',
			promptTranslation: row.showStudyAidsDuringAttempt ? entry.promptTranslation : null,
			focusText: entry.focusText,
			focusReading: entry.focusReading,
			contextText: entry.contextText,
			contextTransliteration: row.showStudyAidsDuringAttempt ? entry.contextTransliteration : null,
			group: entry.groupPublicId ? (groups.get(entry.groupPublicId) ?? null) : null,
			image: entry.imagePublicId
				? {
						publicId: entry.imagePublicId,
						mimeType: entry.imageMimeType,
						width: entry.imageWidth,
						height: entry.imageHeight,
						altText: entry.imageAltText
					}
				: null,
			audio: entry.audioPublicId
				? {
						publicId: entry.audioPublicId,
						mimeType: entry.audioMimeType,
						durationMs: entry.audioDurationMs
					}
				: null,
			options: options.get(entry.position) ?? [],
			selectedOptionId: entry.selectedOptionId
		}))
	};
}

/**
 * Saves one answer, and in practice mode reports whether it was right.
 *
 * The two modes take deliberately separate paths below rather than sharing one path behind a
 * flag. An exam sitting must keep saving silently and stay re-answerable exactly as it did
 * before practice mode existed, and that guarantee is easier to hold — and to review — when
 * breaking it would mean editing the exam branch by name.
 */
export async function saveAnswer(
	db: Database,
	view: AttemptView,
	attemptQuestionId: number,
	selectedOptionId: number | null,
	now: Date,
	/** Already clamped by the caller against what the server can vouch for. */
	elapsedMs: number | null = null
): Promise<WriteResult<AnswerVerdict | null>> {
	if (view.attempt.status !== 'IN_PROGRESS') {
		return { ok: false, message: 'This attempt is no longer open.' };
	}
	if (isExpired(now, view.attempt.expiresAt)) {
		return { ok: false, message: 'Time is up for this attempt.' };
	}

	const served = view.questions.find(
		(question) => question.attemptQuestionId === attemptQuestionId
	);
	if (!served) return { ok: false, message: 'That question is not part of this attempt.' };
	if (!sectionOpen(now, view.sectionDeadlines, served.section)) {
		return { ok: false, message: 'Time is up for this section.' };
	}
	if (
		selectedOptionId !== null &&
		!served.options.some((option) => option.id === selectedOptionId)
	) {
		return { ok: false, message: 'That is not one of this question’s options.' };
	}

	/*
	 * Practice answers are final, and the rule is enforced here rather than only in the DTO's
	 * `canAnswer`. Practice reveals the correct option the moment an answer lands, so without
	 * this a learner could answer wrong, read the key, walk back through the question
	 * navigator and fix it — inflating `raw_score`, and with it the `xp_awarded` that feeds
	 * the public leaderboard. An exam sitting reveals nothing mid-attempt, so it keeps the
	 * free re-answering a real JLPT paper allows.
	 */
	if (isPracticeMode(view.quiz.mode) && served.selectedOptionId !== null) {
		return { ok: false, message: 'You have already answered this question.' };
	}

	const attemptStillOpen = and(
		eq(attempts.id, view.attempt.id),
		eq(attempts.status, 'IN_PROGRESS'),
		or(isNull(attempts.expiresAt), gt(attempts.expiresAt, now))
	);
	const answerCandidate = db
		.select({
			id: sql<number | null>`null`.as('id'),
			attemptId: sql<number>`${view.attempt.id}`.as('attempt_id'),
			attemptQuestionId: sql<number>`${attemptQuestionId}`.as('attempt_question_id'),
			questionId: sql<number>`${served.questionId}`.as('question_id'),
			selectedOptionId: sql<number | null>`${selectedOptionId}`.as('selected_option_id'),
			isCorrect: sql<boolean | null>`null`.as('is_correct'),
			pointsEarned: sql<number | null>`null`.as('points_earned'),
			elapsedMs: sql<number | null>`${elapsedMs}`.as('elapsed_ms'),
			answeredAt: sql<Date>`${Math.floor(now.getTime() / 1000)}`.as('answered_at'),
			createdAt: sql<Date>`(unixepoch())`.as('created_at'),
			updatedAt: sql<Date>`(unixepoch())`.as('updated_at')
		})
		.from(attempts)
		.where(attemptStillOpen);
	const answerWrite = db
		.insert(attemptAnswers)
		.select(answerCandidate)
		.onConflictDoUpdate({
			target: attemptAnswers.attemptQuestionId,
			set: { selectedOptionId, answeredAt: now, updatedAt: now }
		})
		.returning({ id: attemptAnswers.id });
	const bumpRevision = db
		.update(attempts)
		.set({ revision: sql`${attempts.revision} + 1` })
		.where(attemptStillOpen);

	if (!isPracticeMode(view.quiz.mode)) {
		const [written] = await db.batch([answerWrite, bumpRevision]);

		if (written.length === 0) {
			return { ok: false, message: 'This attempt is no longer open.' };
		}

		return { ok: true, value: null };
	}

	/*
	 * The answer key is not in `view`: `frozenOptionsQuery` omits `is_correct` by
	 * construction, so that no payload built from an attempt load can leak it. Reading it
	 * here costs no extra network hop — D1 runs a batch as one transaction over one round
	 * trip, and a later statement sees the earlier ones' writes.
	 *
	 * `is_correct`/`points_earned` are still left NULL on the row. `finalizeAttempt` selects
	 * only `selected_option_id` and re-derives correctness from the frozen key, so writing
	 * them early would buy nothing and add a second place for the two to disagree.
	 */
	const wasCorrect =
		selectedOptionId === null
			? sql<number>`0`
			: sql<number>`coalesce((select ${attemptQuestionOptions.isCorrect}
					from ${attemptQuestionOptions}
					where ${attemptQuestionOptions.id} = ${selectedOptionId}), 0)`;

	/*
	 * The combo is advanced by SQLite, not by the application.
	 *
	 * Reading it, adding one and writing it back from here would let two taps that land
	 * together both read the same value and both write the same successor. Expressing it as
	 * a self-referencing UPDATE keeps the read-modify-write inside the one statement, where
	 * the batch's transaction covers it. A practice question is locked once answered, so
	 * every write that reaches here is a first answer and nothing needs to guard against
	 * re-answering inflating the streak.
	 */
	const advanceCombo = db
		.update(attempts)
		.set({
			revision: sql`${attempts.revision} + 1`,
			currentCombo: sql`case when ${wasCorrect} = 1 then ${attempts.currentCombo} + 1 else 0 end`,
			bestCombo: sql`max(${attempts.bestCombo}, case when ${wasCorrect} = 1 then ${attempts.currentCombo} + 1 else 0 end)`
		})
		.where(attemptStillOpen);

	const verdictQuery = db
		.select({
			correctPosition: attemptQuestionOptions.position,
			explanation: attemptQuestions.explanation
		})
		.from(attemptQuestions)
		.innerJoin(
			attemptQuestionOptions,
			and(
				eq(attemptQuestionOptions.attemptId, attemptQuestions.attemptId),
				eq(attemptQuestionOptions.questionPosition, attemptQuestions.position),
				eq(attemptQuestionOptions.isCorrect, true)
			)
		)
		.where(eq(attemptQuestions.id, attemptQuestionId));

	// Read the streak back rather than recomputing it here, so one place owns the arithmetic.
	const comboQuery = db
		.select({ currentCombo: attempts.currentCombo, bestCombo: attempts.bestCombo })
		.from(attempts)
		.where(eq(attempts.id, view.attempt.id));

	const [written, , verdictRows, comboRows] = await db.batch([
		answerWrite,
		advanceCombo,
		verdictQuery,
		comboQuery
	]);

	if (written.length === 0) {
		return { ok: false, message: 'This attempt is no longer open.' };
	}

	const [key] = verdictRows;
	if (!key) {
		// Publishing refuses a question with no key, so this is the belt to that braces.
		return { ok: true, value: null };
	}

	const selectedPosition =
		served.options.find((option) => option.id === selectedOptionId)?.position ?? null;

	return {
		ok: true,
		value: {
			questionNumber: served.position,
			isCorrect: selectedPosition !== null && selectedPosition === key.correctPosition,
			correctOptionNumber: key.correctPosition,
			explanation: key.explanation,
			combo: comboRows[0]?.currentCombo ?? 0,
			bestCombo: comboRows[0]?.bestCombo ?? 0
		}
	};
}

/**
 * Closes an in-progress attempt without scoring it.
 *
 * The status predicate makes repeated or racing writes harmless. The expiry predicate
 * prevents an exit request from winning after the server-owned deadline; callers settle
 * the clock before and after this write so that case becomes EXPIRED instead.
 */
export async function abandonAttempt(db: Database, attemptId: number, now: Date) {
	const [abandoned] = await db
		.update(attempts)
		.set({ status: 'ABANDONED', updatedAt: now })
		.where(
			and(
				eq(attempts.id, attemptId),
				eq(attempts.status, 'IN_PROGRESS'),
				or(isNull(attempts.expiresAt), gt(attempts.expiresAt, now))
			)
		)
		.returning({ id: attempts.id });

	return abandoned !== undefined;
}
