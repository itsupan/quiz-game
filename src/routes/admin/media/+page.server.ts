import { fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import { enumFilter } from '$lib/features/admin/query-filters';
import {
	deleteMedia,
	getMediaAssetById,
	listMedia,
	requireMediaBucket,
	updateMediaDescription,
	uploadMedia
} from '$lib/features/media/media.server';
import { MEDIA_KINDS, type MediaKind } from '$lib/domain/enums';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = {
		kind: enumFilter<MediaKind>(url, 'kind', MEDIA_KINDS),
		page: Number(url.searchParams.get('page')) || 1
	};

	return { ...(await listMedia(locals.db, filters)), filters };
};

export const actions: Actions = {
	upload: async ({ locals, platform, request }) => {
		const data = await request.formData();
		const file = data.get('file');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Choose a file to upload.' });
		}

		const altText = String(data.get('altText') ?? '').trim() || null;
		const transcript = String(data.get('transcript') ?? '').trim() || null;

		const uploaded = await uploadMedia(
			locals.db,
			requireMediaBucket(platform),
			locals.user?.id ?? null,
			file,
			{ altText, transcript }
		);

		if (!uploaded.ok) {
			return fail(400, { message: uploaded.message });
		}

		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'MEDIA_UPLOADED',
			entityType: 'media_asset',
			entityId: uploaded.value.id,
			after: { kind: uploaded.value.kind, originalFilename: uploaded.value.originalFilename }
		});

		return { ok: true, message: `Uploaded “${uploaded.value.originalFilename ?? 'file'}”.` };
	},

	updateDescription: async ({ locals, request }) => {
		const data = await request.formData();
		const assetId = Number(data.get('assetId'));
		const asset = await getMediaAssetById(locals.db, assetId);

		if (!asset) {
			return fail(404, { message: 'That file no longer exists.' });
		}

		const altText = String(data.get('altText') ?? '').trim() || null;
		const transcript = String(data.get('transcript') ?? '').trim() || null;

		await updateMediaDescription(locals.db, asset.id, {
			altText: asset.kind === 'IMAGE' ? altText : asset.altText,
			transcript: asset.kind === 'AUDIO' ? transcript : asset.transcript
		});

		return { ok: true, message: 'Saved.' };
	},

	delete: async ({ locals, platform, request }) => {
		const data = await request.formData();
		const assetId = Number(data.get('assetId'));
		const asset = await getMediaAssetById(locals.db, assetId);

		if (!asset) {
			return fail(404, { message: 'That file no longer exists.' });
		}

		const removed = await deleteMedia(locals.db, requireMediaBucket(platform), asset);

		if (!removed.ok) {
			return fail(409, { message: removed.message });
		}

		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'MEDIA_DELETED',
			entityType: 'media_asset',
			entityId: asset.id,
			before: { originalFilename: asset.originalFilename }
		});

		return { ok: true, message: 'Deleted.' };
	}
};
