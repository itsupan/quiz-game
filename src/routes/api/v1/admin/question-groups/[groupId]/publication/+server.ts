import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	apiProblem,
	assertSameOrigin,
	parsePublicId,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { recordAudit } from '$lib/features/admin/audit.server';
import {
	groupDetailDto,
	requireGroupDetail
} from '$lib/features/questions/groups-api-detail.server';
import { setGroupStatus } from '$lib/features/questions/groups.server';
import { groupPublishBlockers } from '$lib/features/questions/groups-validation';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const groupId = parsePublicId(params.groupId, 'groupId');
		const found = await requireGroupDetail(locals.db, groupId);
		const blockers = groupPublishBlockers(
			{
				format: found.group.format,
				body: found.group.passageText,
				exampleText: found.group.exampleText
			},
			{ image: found.image, audio: found.audio }
		);

		if (blockers.length > 0) {
			apiProblem(
				409,
				'publish_blocked',
				'Cannot publish',
				'This question group is not ready to publish.',
				blockers.map((message) => ({ field: 'group', message }))
			);
		}

		await setGroupStatus(locals.db, found.group.id, 'PUBLISHED');
		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUESTION_GROUP_PUBLISHED',
			entityType: 'question_group',
			entityId: found.group.id,
			before: { status: found.group.status },
			after: { status: 'PUBLISHED' }
		});

		const updated = await requireGroupDetail(locals.db, groupId);
		return json({ data: groupDetailDto(updated) });
	});

export const DELETE: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const groupId = parsePublicId(params.groupId, 'groupId');
		const found = await requireGroupDetail(locals.db, groupId);

		await setGroupStatus(locals.db, found.group.id, 'ARCHIVED');
		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUESTION_GROUP_ARCHIVED',
			entityType: 'question_group',
			entityId: found.group.id,
			before: { status: found.group.status },
			after: { status: 'ARCHIVED' }
		});

		const updated = await requireGroupDetail(locals.db, groupId);
		return json({ data: groupDetailDto(updated) });
	});
