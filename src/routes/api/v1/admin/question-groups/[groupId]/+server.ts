import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertKnownFields,
	assertSameOrigin,
	parsePublicId,
	readJsonObject,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { recordAudit } from '$lib/features/admin/audit.server';
import {
	groupDetailDto,
	requireGroupDetail
} from '$lib/features/questions/groups-api-detail.server';
import {
	currentGroupFrom,
	GROUP_BODY_FIELDS,
	parseGroupPatchBody
} from '$lib/features/questions/groups-api.server';
import { updateGroup } from '$lib/features/questions/groups.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		const groupId = parsePublicId(params.groupId, 'groupId');
		const found = await requireGroupDetail(locals.db, groupId);

		return json({ data: groupDetailDto(found) });
	});

export const PATCH: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const groupId = parsePublicId(params.groupId, 'groupId');
		const found = await requireGroupDetail(locals.db, groupId);

		const body = await readJsonObject(request);
		assertKnownFields(body, GROUP_BODY_FIELDS);
		const input = await parseGroupPatchBody(
			locals.db,
			currentGroupFrom(found.group, found.image, found.audio),
			body
		);

		await updateGroup(locals.db, found.group.id, input);
		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUESTION_GROUP_UPDATED',
			entityType: 'question_group',
			entityId: found.group.id,
			before: found.group,
			after: input
		});

		const updated = await requireGroupDetail(locals.db, groupId);
		return json({ data: groupDetailDto(updated) });
	});
