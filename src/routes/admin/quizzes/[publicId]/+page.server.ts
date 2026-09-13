import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import { requireMediaBucket } from '$lib/features/media/media.server';
import { resolveQuestionMedia } from '$lib/features/questions/question-media.server';
import { echoValues, parseQuestionForm } from '$lib/features/questions/validation';
import {
	createQuestionForSection,
	deleteSection,
	detachQuestion,
	getQuiz,
	listAttachedQuestions,
	publishAndAttachQuestion,
	quizPublishBlockersFor,
	setQuizStatus,
	updateQuiz,
	upsertSection
} from '$lib/features/quiz/admin/quizzes.server';
import { parseQuizForm, parseQuizSectionForm } from '$lib/features/quiz/admin/validation';
import type { Actions, PageServerLoad } from './$types';

async function load404(locals: App.Locals, publicId: string) {
	const found = await getQuiz(locals.db, publicId);

	if (!found) {
		error(404, 'That quiz does not exist.');
	}

	return found;
}

/**
 * The publish gate's input, assembled once so the load and the publish action can never
 * disagree about whether a quiz is ready.
 */
function blockersFor(
	locals: App.Locals,
	quiz: Awaited<ReturnType<typeof load404>>['quiz'],
	sections: Awaited<ReturnType<typeof load404>>['sections']
) {
	return quizPublishBlockersFor(locals.db, quiz, sections);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { quiz, sections } = await load404(locals, params.publicId);

	return {
		quiz,
		sections,
		// A RANDOM quiz draws from the bank at attempt start, so its paper is empty by
		// design.
		attached: quiz.selectionMode === 'FIXED' ? await listAttachedQuestions(locals.db, quiz.id) : [],
		// Scoring bands are a later epic, so sections here carry no `scoring_band_id` and
		// the quiz reports a raw score only.
		blockers: await blockersFor(locals, quiz, sections)
	};
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		const { quiz } = await load404(locals, params.publicId);
		const parsed = parseQuizForm(await request.formData(), {
			showStudyAidsDuringAttempt: quiz.showStudyAidsDuringAttempt,
			xpReward: quiz.xpReward
		});

		if (!parsed.ok) {
			return fail(400, { errors: parsed.errors, values: parsed.values });
		}

		await updateQuiz(locals.db, quiz.id, parsed.value);

		return { ok: true, message: 'Saved.' };
	},

	saveSection: async ({ locals, params, request }) => {
		const { quiz } = await load404(locals, params.publicId);
		const data = await request.formData();
		// The draw-count rule depends on the quiz, not on the form, so the quiz's own
		// selection mode decides it rather than anything the client sent.
		const parsed = parseQuizSectionForm(data, quiz.selectionMode);

		if (!parsed.ok) {
			return fail(400, { sectionErrors: parsed.errors, sectionValues: parsed.values });
		}

		const rawId = String(data.get('sectionId') ?? '');
		const written = await upsertSection(
			locals.db,
			quiz.id,
			rawId ? Number(rawId) : null,
			parsed.value
		);

		if (!written.ok) {
			return fail(409, { message: written.message });
		}

		return { ok: true, message: 'Section saved.' };
	},

	deleteSection: async ({ locals, params, request }) => {
		const { quiz } = await load404(locals, params.publicId);
		const data = await request.formData();
		const removed = await deleteSection(locals.db, quiz.id, Number(data.get('sectionId')));

		if (!removed.ok) {
			return fail(409, { message: removed.message });
		}

		return { ok: true, message: 'Section removed.' };
	},

	/**
	 * Authoring a question straight from the quiz page, instead of the separate bank
	 * flow. Always lands as a DRAFT in the bank — never attached, never published — so
	 * `publishAndAttach` below stays the one explicit step that makes anything live,
	 * exactly like a question authored through the standalone bank page.
	 */
	createQuestion: async ({ locals, params, platform, request }) => {
		const { quiz, sections } = await load404(locals, params.publicId);
		const data = await request.formData();
		const quizSectionId = Number(data.get('quizSectionId'));
		const section = sections.find((candidate) => candidate.id === quizSectionId);

		if (!section) {
			error(404, 'That section does not belong to this quiz.');
		}

		const parsed = parseQuestionForm(data);

		if (!parsed.ok) {
			return fail(400, {
				quizSectionId,
				errors: parsed.errors,
				values: parsed.values,
				submitted: parsed.submitted
			});
		}

		const media = await resolveQuestionMedia(
			locals.db,
			requireMediaBucket(platform),
			locals.user?.id ?? null,
			data,
			{ imageMediaId: null, audioMediaId: null }
		);

		if (!media.ok) {
			return fail(400, {
				quizSectionId,
				errors: media.errors,
				values: echoValues(data),
				submitted: {
					options: parsed.value.options.map(({ id, body }) => ({ id, body })),
					correctOption: parsed.value.options.findIndex((option) => option.isCorrect)
				}
			});
		}

		const created = await createQuestionForSection(locals.db, locals.user?.id ?? null, {
			...parsed.value,
			...media.value,
			level: quiz.level,
			section: section.section
		});

		if (!created.ok) {
			return fail(400, { quizSectionId, message: created.message });
		}

		return { ok: true, quizSectionId, created: created.value };
	},

	/** The one explicit "make it live" click — publishes the draft and puts it on the paper. */
	publishAndAttach: async ({ locals, params, request }) => {
		const { quiz } = await load404(locals, params.publicId);
		const data = await request.formData();
		const quizSectionId = Number(data.get('quizSectionId'));
		const questionId = Number(data.get('questionId'));

		const written = await publishAndAttachQuestion(
			locals.db,
			locals.user?.id ?? null,
			quiz,
			quizSectionId,
			questionId
		);

		if (!written.ok) {
			return fail(409, { quizSectionId, message: written.message });
		}

		return { ok: true, quizSectionId, message: 'Published and added to the paper.' };
	},

	detachQuestion: async ({ locals, params, request }) => {
		const { quiz } = await load404(locals, params.publicId);
		const data = await request.formData();
		const removed = await detachQuestion(locals.db, quiz.id, Number(data.get('quizQuestionId')));

		if (!removed.ok) {
			return fail(409, { message: removed.message });
		}

		return { ok: true, message: 'Question removed from the paper.' };
	},

	publish: async ({ locals, params }) => {
		const { quiz, sections } = await load404(locals, params.publicId);
		const blockers = await blockersFor(locals, quiz, sections);

		if (blockers.length > 0) {
			return fail(400, { message: blockers.join(' ') });
		}

		await setQuizStatus(locals.db, quiz, 'PUBLISHED');
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'QUIZ_PUBLISHED',
			entityType: 'quiz',
			entityId: quiz.id,
			before: { status: quiz.status },
			after: { status: 'PUBLISHED' }
		});

		return { ok: true, message: 'Published.' };
	},

	archive: async ({ locals, params }) => {
		const { quiz } = await load404(locals, params.publicId);

		await setQuizStatus(locals.db, quiz, 'ARCHIVED');
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'QUIZ_ARCHIVED',
			entityType: 'quiz',
			entityId: quiz.id,
			before: { status: quiz.status },
			after: { status: 'ARCHIVED' }
		});

		return { ok: true, message: 'Archived.' };
	}
};
