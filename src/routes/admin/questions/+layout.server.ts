import { enumFilter } from '$lib/features/admin/query-filters';
import { listQuestions } from '$lib/features/questions/questions.server';
import {
	CONTENT_STATUS,
	JLPT_LEVELS,
	SECTIONS,
	type ContentStatus,
	type JlptLevel,
	type Section
} from '$lib/domain/enums';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const filters = {
		level: enumFilter<JlptLevel>(url, 'level', JLPT_LEVELS),
		section: enumFilter<Section>(url, 'section', SECTIONS),
		status: enumFilter<ContentStatus>(url, 'status', CONTENT_STATUS),
		page: Number(url.searchParams.get('page')) || 1
	};

	return { ...(await listQuestions(locals.db, filters)), filters };
};
