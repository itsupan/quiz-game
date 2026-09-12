import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	apiProblem,
	assertSameOrigin,
	parsePublicId,
	readJsonObject,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import {
	parseMediaDescriptionBody,
	requireMediaByPublicId,
	toMediaDto
} from '$lib/features/media/api.server';
import {
	deleteMedia,
	requireMediaBucket,
	updateMediaDescription
} from '$lib/features/media/media.server';
import { recordAudit } from '$lib/features/admin/audit.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		const mediaId = parsePublicId(params.mediaId, 'mediaId');
		const asset = await requireMediaByPublicId(locals.db, mediaId);

		return json({ data: toMediaDto(asset) });
	});

export const PATCH: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const mediaId = parsePublicId(params.mediaId, 'mediaId');
		const asset = await requireMediaByPublicId(locals.db, mediaId);

		const body = await readJsonObject(request);
		const description = parseMediaDescriptionBody(asset, body);

		await updateMediaDescription(locals.db, asset.id, description);
		const updated = await requireMediaByPublicId(locals.db, mediaId);

		return json({ data: toMediaDto(updated) });
	});

export const DELETE: RequestHandler = async ({ locals, params, platform, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const mediaId = parsePublicId(params.mediaId, 'mediaId');
		const asset = await requireMediaByPublicId(locals.db, mediaId);

		const removed = await deleteMedia(locals.db, requireMediaBucket(platform), asset);
		if (!removed.ok) {
			apiProblem(409, 'media_in_use', 'Conflict', removed.message);
		}

		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'MEDIA_DELETED',
			entityType: 'media_asset',
			entityId: asset.id,
			before: { r2Key: asset.r2Key, originalFilename: asset.originalFilename, kind: asset.kind }
		});

		return new Response(null, { status: 204 });
	});
