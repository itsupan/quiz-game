import { recordAudit } from '$lib/features/admin/audit.server';
import {
	createQuestion,
	getQuestion,
	getQuestionById,
	setQuestionStatus
} from '$lib/features/questions/questions.server';
import { questionPublishBlockers, type QuestionInput } from '$lib/features/questions/validation';
import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import type { Quiz } from '$lib/server/db/schema';
import { attachQuestion } from './paper.server';

export type CreatedDraftQuestion = {
	publicId: string;
	questionId: number;
	stem: string;
	/** Empty when the question is already ready to publish as-is. */
	blockers: string[];
};

function blockersForLoaded(loaded: NonNullable<Awaited<ReturnType<typeof getQuestionById>>>) {
	return questionPublishBlockers(
		{
			stem: loaded.question.stem,
			format: loaded.question.format,
			focusText: loaded.question.focusText,
			contextText: loaded.question.contextText
		},
		{ image: loaded.image, audio: loaded.audio },
		loaded.options,
		loaded.group ? { status: loaded.group.status, blockers: [] } : null
	);
}

/**
 * Creates a bank question as a `DRAFT`, for authoring in the context of one quiz section.
 *
 * Deliberately never attaches or publishes: the admin always takes a separate, explicit
 * step to do that (`publishAndAttachQuestion` below) — matching how every other question
 * on the bank behaves, and keeping "draft until reviewed" true without exceptions for the
 * fast path.
 */
export async function createQuestionForSection(
	db: Database,
	actorUserId: number | null,
	input: QuestionInput
): Promise<WriteResult<CreatedDraftQuestion>> {
	const created = await createQuestion(db, actorUserId, input);
	if (!created.ok) return created;

	// createQuestion only returns a public id; reload by it once to get the internal id
	// and the freshly-written row back in the exact shape the blocker check needs.
	const full = await getQuestion(db, created.value);

	if (!full) {
		return { ok: false, message: 'The question was created but could not be reloaded.' };
	}

	await recordAudit(db, {
		actorUserId,
		action: 'QUESTION_CREATED',
		entityType: 'question',
		entityId: full.question.id,
		after: { status: full.question.status, stem: full.question.stem }
	});

	return {
		ok: true,
		value: {
			publicId: full.question.publicId,
			questionId: full.question.id,
			stem: full.question.stem,
			blockers: blockersForLoaded(full)
		}
	};
}

/**
 * The one explicit "make it live" action, whether it follows a single inline create or a
 * CSV import: publishes the bank question (re-checking every blocker server-side, never
 * trusting the caller) and attaches it to the given quiz section in one step.
 */
export async function publishAndAttachQuestion(
	db: Database,
	actorUserId: number | null,
	quiz: Pick<Quiz, 'id' | 'level'>,
	quizSectionId: number,
	questionId: number
): Promise<WriteResult<void>> {
	const loaded = await getQuestionById(db, questionId);
	if (!loaded) return { ok: false, message: 'That question no longer exists.' };

	const blockers = blockersForLoaded(loaded);
	if (blockers.length > 0) {
		return {
			ok: false,
			message: `This question is not ready to publish: ${blockers.join(' ')}`
		};
	}

	if (loaded.question.status !== 'PUBLISHED') {
		await setQuestionStatus(db, loaded.question.id, 'PUBLISHED');
		await recordAudit(db, {
			actorUserId,
			action: 'QUESTION_PUBLISHED',
			entityType: 'question',
			entityId: loaded.question.id,
			before: { status: loaded.question.status },
			after: { status: 'PUBLISHED' }
		});
	}

	return attachQuestion(db, quiz, quizSectionId, loaded.question.id);
}

export type BulkAttachResult = {
	questionId: number;
	result: WriteResult<void>;
};

/**
 * The CSV-import confirm step: publish-and-attach every successfully created row, in the
 * order given (their CSV row order), stopping for nothing — one row's failure (a blocker
 * that slipped through, a section that filled up) never blocks the rest.
 */
export async function publishAndAttachMany(
	db: Database,
	actorUserId: number | null,
	quiz: Pick<Quiz, 'id' | 'level'>,
	quizSectionId: number,
	questionIds: number[]
): Promise<BulkAttachResult[]> {
	const results: BulkAttachResult[] = [];

	for (const questionId of questionIds) {
		results.push({
			questionId,
			result: await publishAndAttachQuestion(db, actorUserId, quiz, quizSectionId, questionId)
		});
	}

	return results;
}
