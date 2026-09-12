import { error, fail } from '@sveltejs/kit';
import { recordAudit } from '$lib/features/admin/audit.server';
import { countAdmins, getUser, listUsers, updateUserRole, updateUserStatus } from '$lib/features/admin/users/users.server';
import { USER_ROLES, USER_STATUS } from '$lib/domain/enums';
import type { UserRole, UserStatus } from '$lib/domain/enums';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = {
		search: url.searchParams.get('search') || undefined,
		page: Number(url.searchParams.get('page')) || 1
	};

	return { ...(await listUsers(locals.db, filters)), filters };
};

export const actions: Actions = {
	updateRole: async ({ locals, request }) => {
		const data = await request.formData();
		const publicId = String(data.get('publicId') || '');
		const newRole = String(data.get('role')) as UserRole;

		if (!USER_ROLES.includes(newRole)) {
			return fail(400, { message: 'Invalid role.' });
		}

		const targetUser = await getUser(locals.db, publicId);
		if (!targetUser) {
			error(404, 'User not found.');
		}

		if (targetUser.role === newRole) {
			return { ok: true, message: 'Role unchanged.' };
		}

		// Business Rule: Prevent last admin from removing their own admin role
		if (targetUser.id === locals.user?.id && newRole === 'USER') {
			const adminCount = await countAdmins(locals.db);
			if (adminCount <= 1) {
				return fail(400, { message: 'You are the last administrator and cannot remove your own admin role.' });
			}
		}

		await updateUserRole(locals.db, targetUser.id, newRole);
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'USER_ROLE_CHANGED',
			entityType: 'user',
			entityId: targetUser.id,
			before: { role: targetUser.role },
			after: { role: newRole }
		});

		return { ok: true, message: `Changed role for ${targetUser.displayName} to ${newRole}.` };
	},

	updateStatus: async ({ locals, request }) => {
		const data = await request.formData();
		const publicId = String(data.get('publicId') || '');
		const newStatus = String(data.get('status')) as UserStatus;

		if (!USER_STATUS.includes(newStatus)) {
			return fail(400, { message: 'Invalid status.' });
		}

		const targetUser = await getUser(locals.db, publicId);
		if (!targetUser) {
			error(404, 'User not found.');
		}

		if (targetUser.status === newStatus) {
			return { ok: true, message: 'Status unchanged.' };
		}

		if (targetUser.id === locals.user?.id && newStatus === 'SUSPENDED') {
			return fail(400, { message: 'You cannot suspend yourself.' });
		}

		await updateUserStatus(locals.db, targetUser.id, newStatus);
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'USER_STATUS_CHANGED',
			entityType: 'user',
			entityId: targetUser.id,
			before: { status: targetUser.status },
			after: { status: newStatus }
		});

		return { ok: true, message: `Changed status for ${targetUser.displayName} to ${newStatus}.` };
	}
};
