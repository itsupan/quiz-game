import { fail } from '@sveltejs/kit';

import { changePassword, hasPassword, updateDisplayName } from '$lib/server/auth/account';
import { requireMediaBucket, updateAvatar } from '$lib/features/media/media.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;

	return {
		name: user.displayName,
		email: user.email,
		avatarUrl: user.avatarUrl,
		hasPassword: await hasPassword(locals.db, user.id)
	};
};

export const actions: Actions = {
	updateName: async ({ locals, request }) => {
		const data = await request.formData();
		const displayName = String(data.get('displayName') ?? '');

		const result = await updateDisplayName(locals.db, locals.user!.id, displayName);

		if (!result.ok) {
			return fail(400, { field: 'name', message: result.message, name: displayName });
		}

		return { ok: true, field: 'name', message: 'Name updated.' };
	},

	changePassword: async ({ locals, request }) => {
		const data = await request.formData();
		const currentPassword = String(data.get('currentPassword') ?? '');
		const newPassword = String(data.get('newPassword') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');

		if (newPassword !== confirmPassword) {
			return fail(400, { field: 'password', message: 'New passwords do not match.' });
		}

		const result = await changePassword(locals.db, locals.user!.id, currentPassword, newPassword);

		if (!result.ok) {
			return fail(400, { field: 'password', message: result.message });
		}

		return { ok: true, field: 'password', message: 'Password changed.' };
	},

	uploadAvatar: async ({ locals, platform, request }) => {
		const data = await request.formData();
		const file = data.get('avatar');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { field: 'avatar', message: 'Choose an image to upload.' });
		}

		const result = await updateAvatar(
			locals.db,
			requireMediaBucket(platform),
			{ id: locals.user!.id, avatarUrl: locals.user!.avatarUrl },
			file
		);

		if (!result.ok) {
			return fail(400, { field: 'avatar', message: result.message });
		}

		return {
			ok: true,
			field: 'avatar',
			message: 'Profile photo updated.',
			avatarUrl: `/media/${result.value.publicId}`
		};
	}
};
