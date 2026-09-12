import { SECTIONS, type ScoringBand, type Section } from '$lib/domain/enums';

/**
 * The one place in the codebase that decides whether an answer was right.
 *
 * Pure, and deliberately so: it takes the answer key as data rather than reaching for the
 * database, which keeps `question_options.is_correct` inside `$lib/server/**` at the one
 * call site that reads it, and makes every scoring rule testable without D1 — where
 * `db.batch()` is unavailable anyway.
 *
 * Scaled scores are a LINEAR APPROXIMATION of JLPT scaling, which is item-response-theory
 * based and unpublished. Anything built on `scaledTotal` or `bandScores` must be presented
 * to a learner as an estimate, never as an official result.
 */

/** A question this attempt was actually served, with its key. */
export type ServedQuestion = {
	attemptQuestionId: number;
	questionId: number;
	section: Section;
	points: number;
	correctOptionId: number | null;
};

/** A row already saved in `attempt_answers`. A null selection is an explicit skip. */
export type SavedAnswer = {
	attemptQuestionId: number;
	selectedOptionId: number | null;
};

/** A band from `quiz_scoring_bands`, plus the sections that feed it. */
export type BandConfig = {
	code: ScoringBand;
	label: string;
	scaledMax: number;
	passMark: number | null;
	sections: Section[];
};

export type ScoringInput = {
	served: ServedQuestion[];
	answers: SavedAnswer[];
	bands: BandConfig[];
	scaledTotalMax: number | null;
	passMarkTotal: number | null;
};

export type ScoredAnswer = {
	attemptQuestionId: number;
	isCorrect: boolean;
	pointsEarned: number;
};

export type ScoredSection = {
	section: Section;
	rawScore: number;
	rawMax: number;
	correctCount: number;
	questionCount: number;
};

export type ScoredBand = {
	bandCode: ScoringBand;
	label: string;
	rawScore: number;
	rawMax: number;
	scaledScore: number;
	scaledMax: number;
	passMark: number | null;
	passed: boolean | null;
};

export type ScoredAttempt = {
	/** Only the answers that exist, so the caller updates rows rather than inventing them. */
	answers: ScoredAnswer[];
	sectionScores: ScoredSection[];
	bandScores: ScoredBand[];
	rawScore: number;
	rawMax: number;
	correctCount: number;
	questionCount: number;
	scaledTotal: number | null;
	passed: boolean | null;
};

/**
 * The linear approximation, guarded at zero.
 *
 * A band with no questions served has `rawMax === 0`; dividing by it would put `NaN` in an
 * integer column, which SQLite would take without complaint.
 */
function scale(rawScore: number, rawMax: number, scaledMax: number): number {
	if (rawMax === 0) {
		return 0;
	}

	return Math.round((rawScore / rawMax) * scaledMax);
}

/**
 * Scores a whole attempt from what it was served and what was saved against it.
 *
 * Unanswered questions are not an error: a timer expiry scores exactly what made it to the
 * database. They earn zero and still count towards `questionCount` and `rawMax`, because a
 * question you ran out of time for is one you did not get right.
 */
export function scoreAttempt(input: ScoringInput): ScoredAttempt {
	const { served, answers, bands, scaledTotalMax, passMarkTotal } = input;

	const selectionByQuestion = new Map(
		answers.map((answer) => [answer.attemptQuestionId, answer.selectedOptionId])
	);

	const scoredAnswers: ScoredAnswer[] = [];
	const earnedByQuestion = new Map<number, { section: Section; points: number; earned: number }>();

	for (const question of served) {
		const hasAnswer = selectionByQuestion.has(question.attemptQuestionId);
		const selected = selectionByQuestion.get(question.attemptQuestionId) ?? null;

		// A question with no key cannot be got right. Publishing already refuses one, so
		// this is the belt to that braces rather than an expected path.
		const isCorrect =
			question.correctOptionId !== null &&
			selected !== null &&
			selected === question.correctOptionId;
		const pointsEarned = isCorrect ? question.points : 0;

		if (hasAnswer) {
			scoredAnswers.push({
				attemptQuestionId: question.attemptQuestionId,
				isCorrect,
				pointsEarned
			});
		}

		earnedByQuestion.set(question.attemptQuestionId, {
			section: question.section,
			points: question.points,
			earned: pointsEarned
		});
	}

	const totals = [...earnedByQuestion.values()];

	// Canonical section order rather than the order rows arrived in, so a result page reads
	// the same way for every quiz.
	const sectionScores: ScoredSection[] = SECTIONS.filter((section) =>
		totals.some((entry) => entry.section === section)
	).map((section) => {
		const inSection = totals.filter((entry) => entry.section === section);

		return {
			section,
			rawScore: inSection.reduce((sum, entry) => sum + entry.earned, 0),
			rawMax: inSection.reduce((sum, entry) => sum + entry.points, 0),
			correctCount: inSection.filter((entry) => entry.earned > 0).length,
			questionCount: inSection.length
		};
	});

	const bandScores: ScoredBand[] = bands.map((band) => {
		const inBand = totals.filter((entry) => band.sections.includes(entry.section));
		const rawScore = inBand.reduce((sum, entry) => sum + entry.earned, 0);
		const rawMax = inBand.reduce((sum, entry) => sum + entry.points, 0);
		const scaledScore = scale(rawScore, rawMax, band.scaledMax);

		return {
			bandCode: band.code,
			label: band.label,
			rawScore,
			rawMax,
			scaledScore,
			scaledMax: band.scaledMax,
			passMark: band.passMark,
			passed: band.passMark === null ? null : scaledScore >= band.passMark
		};
	});

	const rawScore = totals.reduce((sum, entry) => sum + entry.earned, 0);
	const rawMax = totals.reduce((sum, entry) => sum + entry.points, 0);

	// A quiz with no bands is not scaled-scored at all — a practice drill reports raw marks.
	const scaledTotal =
		bandScores.length > 0
			? bandScores.reduce((sum, band) => sum + band.scaledScore, 0)
			: scaledTotalMax === null
				? null
				: scale(rawScore, rawMax, scaledTotalMax);

	return {
		answers: scoredAnswers,
		sectionScores,
		bandScores,
		rawScore,
		rawMax,
		correctCount: totals.filter((entry) => entry.earned > 0).length,
		questionCount: totals.length,
		scaledTotal,
		passed: verdict(bandScores, scaledTotal, passMarkTotal)
	};
}

/**
 * Whether the sitting is a pass.
 *
 * Null when the quiz sets no bar at all, which is the honest answer for a practice drill —
 * a false there would read as a failure the quiz never claimed to measure.
 *
 * A learner can clear the overall mark and still fail by missing one band's minimum, which
 * is how the real exam works, so every band with a pass mark has a veto.
 */
function verdict(
	bandScores: ScoredBand[],
	scaledTotal: number | null,
	passMarkTotal: number | null
): boolean | null {
	const gated = bandScores.filter((band) => band.passMark !== null);

	if (gated.length === 0 && passMarkTotal === null) {
		return null;
	}

	if (gated.some((band) => band.passed === false)) {
		return false;
	}

	if (passMarkTotal === null) {
		return true;
	}

	return scaledTotal !== null && scaledTotal >= passMarkTotal;
}
