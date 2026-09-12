import { eq } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { attemptQuestionOptions } from '$lib/server/db/schema';

export type FrozenOption = { id: number; body: string; position: number };

/**
 * The options this attempt was actually served, per served question — frozen at
 * `startAttempt` time, so this never touches the live `question_options` table an admin
 * might be mid-edit on. Excludes `isCorrect` by construction, the same guarantee
 * `publicQuestionOptionColumns` gives the live-content path: a payload built from this
 * can never leak the answer key before completion.
 *
 * Keyed by `attempt_questions.position` — the `questionPosition` frozen options are
 * stored under — not by the live `questionId`, since that's the actual scope the frozen
 * table is keyed on.
 */
export async function loadFrozenOptions(
	db: Database,
	attemptId: number
): Promise<Map<number, FrozenOption[]>> {
	const byPosition = new Map<number, FrozenOption[]>();

	const rows = await db
		.select({
			questionPosition: attemptQuestionOptions.questionPosition,
			id: attemptQuestionOptions.id,
			body: attemptQuestionOptions.body,
			position: attemptQuestionOptions.position
		})
		.from(attemptQuestionOptions)
		.where(eq(attemptQuestionOptions.attemptId, attemptId))
		.orderBy(attemptQuestionOptions.position);

	for (const { questionPosition, ...option } of rows) {
		const options = byPosition.get(questionPosition) ?? [];
		options.push(option);
		byPosition.set(questionPosition, options);
	}

	return byPosition;
}
