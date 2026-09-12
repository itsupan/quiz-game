import { and, eq, inArray, sql } from 'drizzle-orm';

import type { ScoringBand, Section } from '$lib/domain/enums';
import type { Database } from '$lib/server/db';
import {
	attemptAnswers,
	attemptBandScores,
	attemptQuestionOptions,
	attemptQuestions,
	attemptScoringBands,
	attemptSectionScores,
	attempts,
	quizzes
} from '$lib/server/db/schema';
import type { AttemptStatus } from '$lib/server/db/schema';
import { scoreAttempt, type BandConfig, type SavedAnswer, type ServedQuestion } from '../scoring';
import { isExpired } from '../timing';
import { loadFrozenOptions } from './questions.server';
import type { AttemptView, ResultView } from './types.server';

type FrozenServedQuestion = {
	attemptQuestionId: number;
	questionId: number;
	section: Section;
	position: number;
	points: number;
	bandCode: ScoringBand | null;
};

/** Groups this attempt's frozen scoring bands by the sections its own served questions fed. */
async function loadFrozenBandConfig(
	db: Database,
	attemptId: number,
	served: Pick<FrozenServedQuestion, 'section' | 'bandCode'>[]
): Promise<BandConfig[]> {
	const bands = await db
		.select({
			bandCode: attemptScoringBands.bandCode,
			label: attemptScoringBands.label,
			scaledMax: attemptScoringBands.scaledMax,
			passMark: attemptScoringBands.passMark
		})
		.from(attemptScoringBands)
		.where(eq(attemptScoringBands.attemptId, attemptId));

	return bands.map((band) => ({
		code: band.bandCode,
		label: band.label,
		scaledMax: band.scaledMax,
		passMark: band.passMark,
		sections: [
			...new Set(
				served.filter((question) => question.bandCode === band.bandCode).map((q) => q.section)
			)
		]
	}));
}

/** This attempt's own frozen answer key: which option, per served question, was correct. */
async function loadCorrectOptionByPosition(
	db: Database,
	attemptId: number
): Promise<Map<number, number>> {
	const rows = await db
		.select({
			questionPosition: attemptQuestionOptions.questionPosition,
			id: attemptQuestionOptions.id
		})
		.from(attemptQuestionOptions)
		.where(
			and(
				eq(attemptQuestionOptions.attemptId, attemptId),
				eq(attemptQuestionOptions.isCorrect, true)
			)
		);

	return new Map(rows.map((row) => [row.questionPosition, row.id]));
}

export async function finalizeAttempt(
	db: Database,
	attemptId: number,
	status: 'SUBMITTED' | 'EXPIRED',
	at: Date
): Promise<void> {
	const [claimable] = await db
		.select({
			id: attempts.id,
			startedAt: attempts.startedAt,
			scaledTotalMax: attempts.scaledTotalMax,
			passMarkTotal: attempts.passMarkTotal
		})
		.from(attempts)
		.where(and(eq(attempts.id, attemptId), eq(attempts.status, 'IN_PROGRESS')));

	if (!claimable) return;

	const served = await db
		.select({
			attemptQuestionId: attemptQuestions.id,
			questionId: attemptQuestions.questionId,
			section: attemptQuestions.section,
			position: attemptQuestions.position,
			points: attemptQuestions.points,
			bandCode: attemptQuestions.bandCode
		})
		.from(attemptQuestions)
		.where(eq(attemptQuestions.attemptId, attemptId));

	const bands = await loadFrozenBandConfig(db, attemptId, served);
	const correctByPosition = await loadCorrectOptionByPosition(db, attemptId);
	const answers = await db
		.select({
			attemptQuestionId: attemptAnswers.attemptQuestionId,
			selectedOptionId: attemptAnswers.selectedOptionId
		})
		.from(attemptAnswers)
		.where(eq(attemptAnswers.attemptId, attemptId));

	const servedQuestions: ServedQuestion[] = served.map((question) => ({
		attemptQuestionId: question.attemptQuestionId,
		questionId: question.questionId,
		section: question.section,
		points: question.points,
		correctOptionId: correctByPosition.get(question.position) ?? null
	}));
	const savedAnswers: SavedAnswer[] = answers.map((answer) => ({
		attemptQuestionId: answer.attemptQuestionId,
		selectedOptionId: answer.selectedOptionId
	}));
	const scored = scoreAttempt({
		served: servedQuestions,
		answers: savedAnswers,
		bands,
		scaledTotalMax: claimable.scaledTotalMax,
		passMarkTotal: claimable.passMarkTotal
	});

	const groups = new Map<string, { isCorrect: boolean; pointsEarned: number; ids: number[] }>();
	for (const answer of scored.answers) {
		const key = `${answer.isCorrect}:${answer.pointsEarned}`;
		const group = groups.get(key) ?? {
			isCorrect: answer.isCorrect,
			pointsEarned: answer.pointsEarned,
			ids: []
		};
		group.ids.push(answer.attemptQuestionId);
		groups.set(key, group);
	}

	const statements = [
		...groups
			.values()
			.map((group) =>
				db
					.update(attemptAnswers)
					.set({ isCorrect: group.isCorrect, pointsEarned: group.pointsEarned })
					.where(inArray(attemptAnswers.attemptQuestionId, group.ids))
			),
		...(scored.sectionScores.length === 0
			? []
			: [
					db
						.insert(attemptSectionScores)
						.values(
							scored.sectionScores.map((section) => ({
								attemptId,
								section: section.section,
								rawScore: section.rawScore,
								rawMax: section.rawMax,
								correctCount: section.correctCount,
								questionCount: section.questionCount
							}))
						)
						.onConflictDoUpdate({
							target: [attemptSectionScores.attemptId, attemptSectionScores.section],
							set: {
								rawScore: sql`excluded.raw_score`,
								rawMax: sql`excluded.raw_max`,
								correctCount: sql`excluded.correct_count`,
								questionCount: sql`excluded.question_count`
							}
						})
				]),
		...(scored.bandScores.length === 0
			? []
			: [
					db
						.insert(attemptBandScores)
						.values(
							scored.bandScores.map((band) => ({
								attemptId,
								bandCode: band.bandCode,
								rawScore: band.rawScore,
								rawMax: band.rawMax,
								scaledScore: band.scaledScore,
								scaledMax: band.scaledMax,
								passMark: band.passMark,
								passed: band.passed
							}))
						)
						.onConflictDoUpdate({
							target: [attemptBandScores.attemptId, attemptBandScores.bandCode],
							set: {
								rawScore: sql`excluded.raw_score`,
								rawMax: sql`excluded.raw_max`,
								scaledScore: sql`excluded.scaled_score`,
								scaledMax: sql`excluded.scaled_max`,
								passMark: sql`excluded.pass_mark`,
								passed: sql`excluded.passed`
							}
						})
				]),
		db
			.update(attempts)
			.set({
				status,
				submittedAt: at,
				rawScore: scored.rawScore,
				rawMax: scored.rawMax,
				correctCount: scored.correctCount,
				questionCount: scored.questionCount,
				scaledTotal: scored.scaledTotal,
				durationMs: at.getTime() - claimable.startedAt.getTime(),
				passed: scored.passed
			})
			.where(and(eq(attempts.id, attemptId), eq(attempts.status, 'IN_PROGRESS')))
	];

	await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
}

export async function enforceDeadline(
	db: Database,
	view: AttemptView,
	now: Date
): Promise<AttemptStatus> {
	if (view.attempt.status !== 'IN_PROGRESS' || !isExpired(now, view.attempt.expiresAt)) {
		return view.attempt.status;
	}

	await finalizeAttempt(db, view.attempt.id, 'EXPIRED', view.attempt.expiresAt ?? now);
	return 'EXPIRED';
}

export async function loadResult(
	db: Database,
	publicId: string,
	userId: number
): Promise<ResultView | null> {
	const [row] = await db
		.select({
			id: attempts.id,
			publicId: attempts.publicId,
			status: attempts.status,
			startedAt: attempts.startedAt,
			submittedAt: attempts.submittedAt,
			durationMs: attempts.durationMs,
			rawScore: attempts.rawScore,
			rawMax: attempts.rawMax,
			correctCount: attempts.correctCount,
			questionCount: attempts.questionCount,
			scaledTotal: attempts.scaledTotal,
			passed: attempts.passed,
			scaledTotalMax: attempts.scaledTotalMax,
			passMarkTotal: attempts.passMarkTotal,
			quizPublicId: quizzes.publicId,
			title: quizzes.title,
			mode: quizzes.mode,
			level: quizzes.level
		})
		.from(attempts)
		.innerJoin(quizzes, eq(quizzes.id, attempts.quizId))
		.where(and(eq(attempts.publicId, publicId), eq(attempts.userId, userId)));

	if (!row || row.status === 'IN_PROGRESS') return null;

	const bandRows = await db
		.select({
			bandCode: attemptBandScores.bandCode,
			scaledScore: attemptBandScores.scaledScore,
			scaledMax: attemptBandScores.scaledMax,
			passMark: attemptBandScores.passMark,
			passed: attemptBandScores.passed
		})
		.from(attemptBandScores)
		.where(eq(attemptBandScores.attemptId, row.id));
	const bandLabels = await db
		.select({ code: attemptScoringBands.bandCode, label: attemptScoringBands.label })
		.from(attemptScoringBands)
		.where(eq(attemptScoringBands.attemptId, row.id));
	const labelByCode = new Map(bandLabels.map((band) => [band.code, band.label]));

	const served = await db
		.select({
			attemptQuestionId: attemptQuestions.id,
			questionId: attemptQuestions.questionId,
			section: attemptQuestions.section,
			position: attemptQuestions.position,
			points: attemptQuestions.points,
			stem: attemptQuestions.stem,
			explanation: attemptQuestions.explanation,
			imagePublicId: attemptQuestions.imagePublicId,
			imageAltText: attemptQuestions.imageAltText,
			audioPublicId: attemptQuestions.audioPublicId,
			audioTranscript: attemptQuestions.audioTranscript,
			selectedOptionId: attemptAnswers.selectedOptionId,
			isCorrect: attemptAnswers.isCorrect,
			pointsEarned: attemptAnswers.pointsEarned
		})
		.from(attemptQuestions)
		.leftJoin(attemptAnswers, eq(attemptAnswers.attemptQuestionId, attemptQuestions.id))
		.where(eq(attemptQuestions.attemptId, row.id))
		.orderBy(attemptQuestions.position);

	const options = await loadFrozenOptions(db, row.id);
	const correctByPosition = await loadCorrectOptionByPosition(db, row.id);

	return {
		attempt: {
			publicId: row.publicId,
			status: row.status,
			startedAt: row.startedAt,
			submittedAt: row.submittedAt,
			durationMs: row.durationMs,
			rawScore: row.rawScore,
			rawMax: row.rawMax,
			correctCount: row.correctCount,
			questionCount: row.questionCount,
			scaledTotal: row.scaledTotal,
			passed: row.passed
		},
		quiz: {
			publicId: row.quizPublicId,
			title: row.title,
			mode: row.mode,
			level: row.level,
			scaledTotalMax: row.scaledTotalMax,
			passMarkTotal: row.passMarkTotal
		},
		bandScores: bandRows.map((band) => ({
			bandCode: band.bandCode,
			label: labelByCode.get(band.bandCode) ?? band.bandCode,
			scaledScore: band.scaledScore,
			scaledMax: band.scaledMax,
			passMark: band.passMark,
			passed: band.passed
		})),
		questions: served.map((entry) => ({
			attemptQuestionId: entry.attemptQuestionId,
			questionId: entry.questionId,
			section: entry.section,
			position: entry.position,
			points: entry.points,
			stem: entry.stem ?? '',
			explanation: entry.explanation,
			image: entry.imagePublicId
				? { publicId: entry.imagePublicId, altText: entry.imageAltText }
				: null,
			audio: entry.audioPublicId
				? { publicId: entry.audioPublicId, transcript: entry.audioTranscript }
				: null,
			options: options.get(entry.position) ?? [],
			selectedOptionId: entry.selectedOptionId,
			correctOptionId: correctByPosition.get(entry.position) ?? null,
			isCorrect: entry.isCorrect ?? false,
			pointsEarned: entry.pointsEarned ?? 0
		}))
	};
}
