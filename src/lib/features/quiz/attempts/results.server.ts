import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import {
	attemptAnswers,
	attemptBandScores,
	attemptQuestions,
	attemptSectionScores,
	attempts,
	questionOptions,
	questions,
	quizScoringBands,
	quizzes,
	quizSections
} from '$lib/server/db/schema';
import type { AttemptStatus } from '$lib/server/db/schema';
import { scoreAttempt, type BandConfig, type SavedAnswer, type ServedQuestion } from '../scoring';
import { isExpired } from '../timing';
import { audioAsset, imageAsset, loadPublicOptions } from './questions.server';
import type { AttemptView, ResultView } from './types.server';

async function loadBandConfig(db: Database, quizId: number): Promise<BandConfig[]> {
	const bands = await db
		.select({
			id: quizScoringBands.id,
			code: quizScoringBands.code,
			label: quizScoringBands.label,
			scaledMax: quizScoringBands.scaledMax,
			passMark: quizScoringBands.passMark
		})
		.from(quizScoringBands)
		.where(eq(quizScoringBands.quizId, quizId));

	if (bands.length === 0) return [];

	const sections = await db
		.select({ section: quizSections.section, scoringBandId: quizSections.scoringBandId })
		.from(quizSections)
		.where(eq(quizSections.quizId, quizId));

	return bands.map((band) => ({
		code: band.code,
		label: band.label,
		scaledMax: band.scaledMax,
		passMark: band.passMark,
		sections: sections
			.filter((section) => section.scoringBandId === band.id)
			.map((section) => section.section)
	}));
}

export async function finalizeAttempt(
	db: Database,
	attemptId: number,
	status: 'SUBMITTED' | 'EXPIRED',
	at: Date
): Promise<void> {
	const [claimable] = await db
		.select({ id: attempts.id, startedAt: attempts.startedAt, quizId: attempts.quizId })
		.from(attempts)
		.where(and(eq(attempts.id, attemptId), eq(attempts.status, 'IN_PROGRESS')));

	if (!claimable) return;

	const [quiz] = await db
		.select({ scaledTotalMax: quizzes.scaledTotalMax, passMarkTotal: quizzes.passMarkTotal })
		.from(quizzes)
		.where(eq(quizzes.id, claimable.quizId));
	const bands = await loadBandConfig(db, claimable.quizId);
	const served = await db
		.select({
			attemptQuestionId: attemptQuestions.id,
			questionId: attemptQuestions.questionId,
			section: attemptQuestions.section,
			points: attemptQuestions.points
		})
		.from(attemptQuestions)
		.where(eq(attemptQuestions.attemptId, attemptId));

	const questionIds = served.map((question) => question.questionId);
	const correctOptions =
		questionIds.length > 0
			? await db
					.select({ questionId: questionOptions.questionId, id: questionOptions.id })
					.from(questionOptions)
					.where(
						and(
							inArray(questionOptions.questionId, questionIds),
							eq(questionOptions.isCorrect, true)
						)
					)
			: [];
	const correctByQuestion = new Map(correctOptions.map((option) => [option.questionId, option.id]));
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
		correctOptionId: correctByQuestion.get(question.questionId) ?? null
	}));
	const savedAnswers: SavedAnswer[] = answers.map((answer) => ({
		attemptQuestionId: answer.attemptQuestionId,
		selectedOptionId: answer.selectedOptionId
	}));
	const scored = scoreAttempt({
		served: servedQuestions,
		answers: savedAnswers,
		bands,
		scaledTotalMax: quiz.scaledTotalMax,
		passMarkTotal: quiz.passMarkTotal
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
			quizId: quizzes.id,
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
			quizPublicId: quizzes.publicId,
			title: quizzes.title,
			mode: quizzes.mode,
			level: quizzes.level,
			scaledTotalMax: quizzes.scaledTotalMax,
			passMarkTotal: quizzes.passMarkTotal
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
		.select({ code: quizScoringBands.code, label: quizScoringBands.label })
		.from(quizScoringBands)
		.where(eq(quizScoringBands.quizId, row.quizId));
	const labelByCode = new Map(bandLabels.map((band) => [band.code, band.label]));

	const served = await db
		.select({
			attemptQuestionId: attemptQuestions.id,
			questionId: attemptQuestions.questionId,
			section: attemptQuestions.section,
			position: attemptQuestions.position,
			points: attemptQuestions.points,
			stem: questions.stem,
			explanation: questions.explanation,
			imagePublicId: imageAsset.publicId,
			imageAltText: imageAsset.altText,
			audioPublicId: audioAsset.publicId,
			audioTranscript: audioAsset.transcript,
			selectedOptionId: attemptAnswers.selectedOptionId,
			isCorrect: attemptAnswers.isCorrect,
			pointsEarned: attemptAnswers.pointsEarned
		})
		.from(attemptQuestions)
		.innerJoin(questions, eq(questions.id, attemptQuestions.questionId))
		.leftJoin(imageAsset, eq(imageAsset.id, questions.imageMediaId))
		.leftJoin(audioAsset, eq(audioAsset.id, questions.audioMediaId))
		.leftJoin(attemptAnswers, eq(attemptAnswers.attemptQuestionId, attemptQuestions.id))
		.where(eq(attemptQuestions.attemptId, row.id))
		.orderBy(attemptQuestions.position);

	const questionIds = served.map((entry) => entry.questionId);
	const options = await loadPublicOptions(db, questionIds);
	const correctOptions =
		questionIds.length > 0
			? await db
					.select({ questionId: questionOptions.questionId, id: questionOptions.id })
					.from(questionOptions)
					.where(
						and(
							inArray(questionOptions.questionId, questionIds),
							eq(questionOptions.isCorrect, true)
						)
					)
			: [];
	const correctByQuestion = new Map(correctOptions.map((option) => [option.questionId, option.id]));

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
			stem: entry.stem,
			explanation: entry.explanation,
			image: entry.imagePublicId
				? { publicId: entry.imagePublicId, altText: entry.imageAltText }
				: null,
			audio: entry.audioPublicId
				? { publicId: entry.audioPublicId, transcript: entry.audioTranscript }
				: null,
			options: options.get(entry.questionId) ?? [],
			selectedOptionId: entry.selectedOptionId,
			correctOptionId: correctByQuestion.get(entry.questionId) ?? null,
			isCorrect: entry.isCorrect ?? false,
			pointsEarned: entry.pointsEarned ?? 0
		}))
	};
}
