import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	apiProblem,
	assertKnownFields,
	assertSameOrigin,
	parsePublicId,
	readJsonObject,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { recordAudit } from '$lib/features/admin/audit.server';
import {
	parseUserPatchBody,
	toUserDto,
	USER_PATCH_FIELDS
} from '$lib/features/admin/users/api.server';
import { countAdmins, getUser, updateUser } from '$lib/features/admin/users/users.server';
import type { RequestHandler } from './$types';

async function requireUser(locals: App.Locals, publicId: string) {
	const user = await getUser(locals.db, publicId);
	if (!user) apiProblem(404, 'user_not_found', 'User not found', 'That user does not exist.');
	return user;
}

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		const user = await requireUser(locals, parsePublicId(params.userId, 'userId'));
		return json({ data: toUserDto(user) });
	});

export const PATCH: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const actor = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const user = await requireUser(locals, parsePublicId(params.userId, 'userId'));
		const body = await readJsonObject(request);
		assertKnownFields(body, USER_PATCH_FIELDS);
		const patch = parseUserPatchBody(body);

		if (user.id === actor.id && patch.status === 'SUSPENDED') {
			apiProblem(409, 'self_suspension', 'Conflict', 'You cannot suspend yourself.');
		}
		if (user.id === actor.id && patch.role === 'USER' && (await countAdmins(locals.db)) <= 1) {
			apiProblem(
				409,
				'last_administrator',
				'Conflict',
				'You are the last administrator and cannot remove your own admin role.'
			);
		}

		await updateUser(locals.db, user.id, patch);

		if (patch.role !== undefined && patch.role !== user.role) {
			await recordAudit(locals.db, {
				actorUserId: actor.id,
				action: 'USER_ROLE_CHANGED',
				entityType: 'user',
				entityId: user.id,
				before: { role: user.role },
				after: { role: patch.role }
			});
		}
		if (patch.status !== undefined && patch.status !== user.status) {
			await recordAudit(locals.db, {
				actorUserId: actor.id,
				action: 'USER_STATUS_CHANGED',
				entityType: 'user',
				entityId: user.id,
				before: { status: user.status },
				after: { status: patch.status }
			});
		}
		if (
			(patch.displayName !== undefined && patch.displayName !== user.displayName) ||
			(patch.jlptLevel !== undefined && patch.jlptLevel !== user.jlptLevel)
		) {
			await recordAudit(locals.db, {
				actorUserId: actor.id,
				action: 'USER_PROFILE_CHANGED',
				entityType: 'user',
				entityId: user.id,
				before: { displayName: user.displayName, jlptLevel: user.jlptLevel },
				after: {
					displayName: patch.displayName ?? user.displayName,
					jlptLevel: patch.jlptLevel === undefined ? user.jlptLevel : patch.jlptLevel
				}
			});
		}

		return json({ data: toUserDto(await requireUser(locals, user.publicId)) });
	});
