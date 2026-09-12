import { inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import type { Database } from '$lib/server/db';
import { mediaAssets, publicQuestionOptionColumns, questionOptions } from '$lib/server/db/schema';
import type { PublicQuestionOption } from '$lib/server/db/schema';

export const imageAsset = alias(mediaAssets, 'image_asset');
export const audioAsset = alias(mediaAssets, 'audio_asset');

export async function loadPublicOptions(
	db: Database,
	questionIds: number[]
): Promise<Map<number, PublicQuestionOption[]>> {
	const byQuestion = new Map<number, PublicQuestionOption[]>();

	if (questionIds.length === 0) return byQuestion;

	const rows = await db
		.select({ ...publicQuestionOptionColumns, questionId: questionOptions.questionId })
		.from(questionOptions)
		.where(inArray(questionOptions.questionId, [...new Set(questionIds)]))
		.orderBy(questionOptions.position);

	for (const { questionId, ...option } of rows) {
		const options = byQuestion.get(questionId) ?? [];
		options.push(option);
		byQuestion.set(questionId, options);
	}

	return byQuestion;
}
