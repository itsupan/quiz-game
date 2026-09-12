import { json } from '@sveltejs/kit';

import { MEDIA_KINDS } from '$lib/domain/enums';
import {
	apiEndpoint,
	apiProblem,
	assertKnownQueryParams,
	assertNoDuplicateParams,
	assertSameOrigin,
	parseEnumQuery,
	parseLimit,
	parsePageNumber,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import {
	assertAcceptedMimeType,
	parseMediaUploadForm,
	toMediaDto
} from '$lib/features/media/api.server';
import { listMedia, requireMediaBucket, uploadMedia } from '$lib/features/media/media.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['kind', 'page', 'limit'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);

		const page = await listMedia(locals.db, {
			kind: parseEnumQuery(url.searchParams.get('kind'), MEDIA_KINDS, 'kind'),
			page: parsePageNumber(url.searchParams.get('page')),
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({
			data: page.items.map(toMediaDto),
			page: {
				number: page.page,
				size: page.items.length,
				total: page.total,
				totalPages: page.pageCount
			}
		});
	});

export const POST: RequestHandler = async ({ locals, platform, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);

		const data = await request.formData();
		const { file, altText, transcript } = parseMediaUploadForm(data);
		assertAcceptedMimeType(file);

		const uploaded = await uploadMedia(locals.db, requireMediaBucket(platform), user.id, file, {
			altText,
			transcript
		});

		if (!uploaded.ok) {
			// Only reachable for the empty/oversized checks `describeUpload` still runs —
			// the MIME type is already known-good at this point, so this is a body
			// validation failure (422), not the unsupported-media-type case (415).
			apiProblem(422, 'validation_failed', 'Validation failed', uploaded.message, [
				{ field: 'file', message: uploaded.message }
			]);
		}

		return json(
			{ data: toMediaDto(uploaded.value) },
			{ status: 201, headers: { location: `/api/v1/admin/media/${uploaded.value.publicId}` } }
		);
	});
