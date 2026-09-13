import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import {
	commitImportedQuestions,
	toPreviewRow,
	validateImportCsv,
	type ImportPreviewRow
} from '$lib/features/questions/import.server';
import { getQuiz } from '$lib/features/quiz/admin/quizzes.server';
import { publishAndAttachMany } from '$lib/features/quiz/admin/authoring.server';
import type { Actions, PageServerLoad } from './$types';

async function load404(locals: App.Locals, publicId: string) {
	const found = await getQuiz(locals.db, publicId);
	if (!found) error(404, 'That quiz does not exist.');
	return found;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { quiz, sections } = await load404(locals, params.publicId);
	const sectionId = Number(url.searchParams.get('section'));
	const section = sections.find((candidate) => candidate.id === sectionId) ?? null;

	return { quiz, sections, section };
};

export const actions: Actions = {
	preview: async ({ locals, params, request }) => {
		const { quiz, sections } = await load404(locals, params.publicId);
		const data = await request.formData();
		const quizSectionId = Number(data.get('quizSectionId'));
		const section = sections.find((candidate) => candidate.id === quizSectionId);

		if (!section) {
			return fail(400, { message: 'Choose a section before uploading a file.' });
		}

		const file = data.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { quizSectionId, message: 'Choose a CSV file to upload.' });
		}

		const csvText = await file.text();
		const validated = await validateImportCsv(locals.db, csvText, {
			level: quiz.level,
			section: section.section
		});

		if (!validated.ok) {
			return fail(400, { quizSectionId, message: validated.error });
		}

		const preview: ImportPreviewRow[] = validated.rows.map(toPreviewRow);

		return { ok: true, quizSectionId, csvText, preview };
	},

	commit: async ({ locals, params, request }) => {
		const { quiz, sections } = await load404(locals, params.publicId);
		const data = await request.formData();
		const quizSectionId = Number(data.get('quizSectionId'));
		const section = sections.find((candidate) => candidate.id === quizSectionId);
		const csvText = String(data.get('csvText') ?? '');

		if (!section) {
			return fail(400, { message: 'That section no longer belongs to this quiz.' });
		}

		// Re-validated from the same text rather than trusting the earlier preview: nothing
		// server-side was held between requests, and content (media, in particular) can
		// change between an admin previewing a file and confirming it.
		const validated = await validateImportCsv(locals.db, csvText, {
			level: quiz.level,
			section: section.section
		});

		if (!validated.ok) {
			return fail(400, { quizSectionId, message: validated.error });
		}

		const actorUserId = locals.user?.id ?? null;
		const okRows = validated.rows.filter((row) => row.ok);
		const created = await commitImportedQuestions(
			locals.db,
			actorUserId,
			okRows.map((row) => ({ line: row.line, value: row.value }))
		);

		const attached = await publishAndAttachMany(
			locals.db,
			actorUserId,
			quiz,
			quizSectionId,
			created.map((row) => row.questionId)
		);

		const outcomes = created.map((row) => {
			const attachResult = attached.find((entry) => entry.questionId === row.questionId);
			return {
				line: row.line,
				publicId: row.publicId,
				published: attachResult?.result.ok ?? false,
				message: attachResult && !attachResult.result.ok ? attachResult.result.message : null
			};
		});

		await recordAudit(locals.db, {
			actorUserId,
			action: 'QUESTION_IMPORTED',
			entityType: 'quiz',
			entityId: quiz.id,
			after: {
				quizSectionId,
				created: created.length,
				published: outcomes.filter((row) => row.published).length,
				rejected: validated.rows.length - okRows.length
			}
		});

		return {
			ok: true,
			quizSectionId,
			committed: {
				rejected: validated.rows
					.filter((row): row is Extract<typeof row, { ok: false }> => !row.ok)
					.map((row) => ({ line: row.line, errors: row.errors })),
				outcomes
			}
		};
	}
};
