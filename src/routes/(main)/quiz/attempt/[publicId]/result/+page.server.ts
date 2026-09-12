import { error, redirect } from '@sveltejs/kit';

import { enforceDeadline, loadAttempt, loadResult } from '$lib/features/quiz/attempts.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	// A stale link to an attempt that only just ran out of time still needs its clock
	// settled before there is a result to show.
	const view = await loadAttempt(locals.db, params.publicId, locals.user!.id);

	if (view) {
		const status = await enforceDeadline(locals.db, view, new Date());

		if (status === 'IN_PROGRESS') {
			redirect(303, `/quiz/attempt/${params.publicId}`);
		}
	}

	const result = await loadResult(locals.db, params.publicId, locals.user!.id);

	if (!result) {
		error(404, 'That result does not exist.');
	}

	return { result };
};
