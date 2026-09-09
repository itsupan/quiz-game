import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import {
	deleteSection,
	getQuiz,
	quizPublishBlockers,
	setQuizStatus,
	updateQuiz,
	upsertSection
} from '$lib/features/admin/quizzes.server';
import { parseQuizForm, parseQuizSectionForm } from '$lib/features/admin/validation';
import type { Actions, PageServerLoad } from './$types';

async function load404(locals: App.Locals, publicId: string) {
	const found = await getQuiz(locals.db, publicId);

	if (!found) {
		error(404, 'That quiz does not exist.');
	}

	return found;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { quiz, sections } = await load404(locals, params.publicId);

	return {
		quiz,
		sections,
		// Scoring bands are a later epic, so sections here carry no `scoring_band_id` and
		// the quiz reports a raw score only.
		blockers: quizPublishBlockers(quiz, sections)
	};
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		const { quiz } = await load404(locals, params.publicId);
		const parsed = parseQuizForm(await request.formData());

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

	publish: async ({ locals, params }) => {
		const { quiz, sections } = await load404(locals, params.publicId);
		const blockers = quizPublishBlockers(quiz, sections);

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
