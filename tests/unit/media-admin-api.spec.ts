import { beforeEach, describe, expect, it } from 'vitest';

import {
	assertAcceptedMimeType,
	parseMediaDescriptionBody,
	parseMediaUploadForm,
	requireMediaByPublicId,
	toMediaDto
} from '$lib/features/media/api.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { ApiProblem } from '$lib/server/http/problem';
import { mediaAssets } from '$lib/server/db/schema';

let db: TestDatabase;

beforeEach(() => {
	db = createTestDatabase().db;
});

describe('assertAcceptedMimeType', () => {
	it('accepts every image and audio type the app supports', () => {
		for (const type of [
			'image/png',
			'image/jpeg',
			'image/webp',
			'audio/mpeg',
			'audio/mp4',
			'audio/ogg'
		]) {
			expect(() => assertAcceptedMimeType(new File(['x'], 'f', { type }))).not.toThrow();
		}
	});

	it('rejects SVG specifically, as a stored-XSS vector', () => {
		expect(() =>
			assertAcceptedMimeType(new File(['<svg/>'], 'f.svg', { type: 'image/svg+xml' }))
		).toThrow(ApiProblem);

		try {
			assertAcceptedMimeType(new File(['<svg/>'], 'f.svg', { type: 'image/svg+xml' }));
		} catch (cause) {
			expect((cause as ApiProblem).status).toBe(415);
		}
	});

	it('rejects an unrecognized type with 415', () => {
		expect(() => assertAcceptedMimeType(new File(['x'], 'f', { type: 'application/pdf' }))).toThrow(
			ApiProblem
		);
	});
});

describe('parseMediaUploadForm', () => {
	it('reads the file and optional description fields', () => {
		const data = new FormData();
		data.set('file', new File(['x'], 'f.png', { type: 'image/png' }));
		data.set('altText', ' a red square ');

		const result = parseMediaUploadForm(data);
		expect(result.file.name).toBe('f.png');
		expect(result.altText).toBe('a red square');
		expect(result.transcript).toBeNull();
	});

	it('requires a file', () => {
		expect(() => parseMediaUploadForm(new FormData())).toThrow(ApiProblem);
	});

	it('rejects an unknown field', () => {
		const data = new FormData();
		data.set('file', new File(['x'], 'f.png', { type: 'image/png' }));
		data.set('bogus', '1');
		expect(() => parseMediaUploadForm(data)).toThrow(ApiProblem);
	});
});

describe('parseMediaDescriptionBody', () => {
	const image = { kind: 'IMAGE' as const, altText: 'old alt', transcript: null };
	const audio = { kind: 'AUDIO' as const, altText: null, transcript: 'old transcript' };

	it('updates altText on an image', () => {
		expect(parseMediaDescriptionBody(image, { altText: 'new alt' })).toEqual({
			altText: 'new alt',
			transcript: null
		});
	});

	it('leaves altText unchanged when omitted', () => {
		expect(parseMediaDescriptionBody(image, {})).toEqual({ altText: 'old alt', transcript: null });
	});

	it('rejects setting transcript on an image', () => {
		expect(() => parseMediaDescriptionBody(image, { transcript: 'x' })).toThrow(ApiProblem);
	});

	it('rejects setting altText on audio', () => {
		expect(() => parseMediaDescriptionBody(audio, { altText: 'x' })).toThrow(ApiProblem);
	});

	it('rejects an unknown field', () => {
		expect(() => parseMediaDescriptionBody(image, { bogus: 1 })).toThrow(ApiProblem);
	});
});

describe('requireMediaByPublicId', () => {
	it('404s for a nonexistent asset', async () => {
		await expect(requireMediaByPublicId(db, '01JSEEDDOESNOTEXIST00000000')).rejects.toThrow(
			ApiProblem
		);
	});

	it('returns the asset when it exists', async () => {
		const [created] = await db
			.insert(mediaAssets)
			.values({ kind: 'IMAGE', r2Key: 'a.png', mimeType: 'image/png', byteSize: 1 })
			.returning();

		const found = await requireMediaByPublicId(db, created.publicId);
		expect(found.id).toBe(created.id);
	});
});

describe('toMediaDto', () => {
	it('never leaks the internal id or r2Key, and links to the serving route', () => {
		const dto = toMediaDto({
			id: 1,
			publicId: '01JSEEDASSETPNG00000000000',
			kind: 'IMAGE',
			r2Key: 'secret-key.png',
			mimeType: 'image/png',
			byteSize: 10,
			durationMs: null,
			width: null,
			height: null,
			altText: 'alt',
			transcript: null,
			originalFilename: 'f.png',
			uploadedBy: null,
			createdAt: new Date('2026-01-01T00:00:00.000Z')
		});

		expect(dto).not.toHaveProperty('r2Key');
		expect(dto).not.toHaveProperty('uploadedBy');
		expect(dto.id).toBe('01JSEEDASSETPNG00000000000');
		expect(dto.url).toBe('/media/01JSEEDASSETPNG00000000000');
	});
});
