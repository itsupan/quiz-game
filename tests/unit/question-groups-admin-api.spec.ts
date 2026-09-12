import { beforeEach, describe, expect, it } from 'vitest';

import {
	currentGroupFrom,
	parseGroupCreateBody,
	parseGroupPatchBody
} from '$lib/features/questions/groups-api.server';
import {
	groupDetailDto,
	requireGroupDetail
} from '$lib/features/questions/groups-api-detail.server';
import { groupPublishBlockers } from '$lib/features/questions/groups-validation';
import {
	createGroup,
	getGroup,
	listGroups,
	setGroupStatus,
	updateGroup
} from '$lib/features/questions/groups.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { ApiProblem } from '$lib/server/http/problem';
import { mediaAssets, users } from '$lib/server/db/schema';

let db: TestDatabase;
let adminId: number;
let imageId: string;
let audioWithTranscriptId: string;

function validCreateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		level: 'N3',
		section: 'GRAMMAR_READING',
		format: 'READING_PASSAGE',
		title: 'お知らせ',
		body: '当図書館は来月から開館時間を変更いたします。',
		instruction: '次の文章を読んで、質問に答えなさい。',
		...overrides
	};
}

beforeEach(async () => {
	db = createTestDatabase().db;

	const [admin] = await db
		.insert(users)
		.values({ email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN' })
		.returning({ id: users.id });
	adminId = admin.id;

	const [image] = await db
		.insert(mediaAssets)
		.values({
			kind: 'IMAGE',
			r2Key: 'image.png',
			mimeType: 'image/png',
			byteSize: 10,
			altText: 'a red square',
			uploadedBy: adminId
		})
		.returning({ publicId: mediaAssets.publicId });
	imageId = image.publicId;

	const [audioReady] = await db
		.insert(mediaAssets)
		.values({
			kind: 'AUDIO',
			r2Key: 'ready.mp3',
			mimeType: 'audio/mpeg',
			byteSize: 10,
			transcript: 'こんにちは。'
		})
		.returning({ publicId: mediaAssets.publicId });
	audioWithTranscriptId = audioReady.publicId;
});

describe('parseGroupCreateBody', () => {
	it('accepts a well-formed reading passage body', async () => {
		const result = await parseGroupCreateBody(db, validCreateBody());
		expect(result).toMatchObject({
			level: 'N3',
			section: 'GRAMMAR_READING',
			format: 'READING_PASSAGE',
			title: 'お知らせ',
			body: '当図書館は来月から開館時間を変更いたします。'
		});
	});

	it('rejects a missing required field', async () => {
		const body = validCreateBody();
		delete body.format;
		await expect(parseGroupCreateBody(db, body)).rejects.toThrow(ApiProblem);
	});

	it('rejects an unknown format value', async () => {
		await expect(
			parseGroupCreateBody(db, validCreateBody({ format: 'NOT_A_FORMAT' }))
		).rejects.toThrow(ApiProblem);
	});

	it('resolves image/audio public ids to internal ids when the kind matches', async () => {
		const result = await parseGroupCreateBody(
			db,
			validCreateBody({ format: 'LISTENING_CLIP', imageId, audioId: audioWithTranscriptId })
		);
		expect(result.imageMediaId).not.toBeNull();
		expect(result.audioMediaId).not.toBeNull();
	});

	it('rejects a media id of the wrong kind', async () => {
		await expect(parseGroupCreateBody(db, validCreateBody({ audioId: imageId }))).rejects.toThrow(
			ApiProblem
		);
	});
});

describe('parseGroupPatchBody', () => {
	function currentFor(overrides: Record<string, unknown> = {}) {
		return {
			level: 'N3' as const,
			section: 'GRAMMAR_READING' as const,
			format: 'READING_PASSAGE' as const,
			title: 'old title',
			body: 'old body',
			instruction: 'old instruction',
			bodyTranslation: null,
			exampleText: null,
			exampleTransliteration: null,
			exampleTranslation: null,
			imageId: null,
			audioId: null,
			...overrides
		};
	}

	it('keeps fields untouched when the patch omits them', async () => {
		const result = await parseGroupPatchBody(db, currentFor(), { title: 'new title' });
		expect(result.title).toBe('new title');
		expect(result.body).toBe('old body');
		expect(result.instruction).toBe('old instruction');
	});

	it('clears a nullable field with an explicit null, distinct from omitting it', async () => {
		const result = await parseGroupPatchBody(db, currentFor(), { instruction: null });
		expect(result.instruction).toBeNull();
	});

	it('clears a media reference by patching it to null', async () => {
		const result = await parseGroupPatchBody(db, currentFor({ imageId }), { imageId: null });
		expect(result.imageMediaId).toBeNull();
	});
});

describe('groupPublishBlockers', () => {
	it('blocks a reading passage group with empty body', () => {
		const blockers = groupPublishBlockers(
			{ format: 'READING_PASSAGE', body: '  ', exampleText: null },
			{ image: null, audio: null }
		);
		expect(blockers).toContain('A reading passage group needs non-empty body text.');
	});

	it('blocks a listening clip group with no attached audio', () => {
		const blockers = groupPublishBlockers(
			{ format: 'LISTENING_CLIP', body: null, exampleText: null },
			{ image: null, audio: null }
		);
		expect(blockers).toContain('A listening clip group needs an attached audio asset.');
	});

	it('blocks a listening clip group whose audio has no transcript', () => {
		const blockers = groupPublishBlockers(
			{ format: 'LISTENING_CLIP', body: null, exampleText: null },
			{ image: null, audio: { transcript: null } }
		);
		expect(blockers).toContain(
			'The attached audio needs a transcript before this group can be published.'
		);
	});

	it('accepts a listening clip group with a transcribed audio asset', () => {
		const blockers = groupPublishBlockers(
			{ format: 'LISTENING_CLIP', body: null, exampleText: null },
			{ image: null, audio: { transcript: 'hello' } }
		);
		expect(blockers).toEqual([]);
	});

	it('blocks a concept-review group missing explanatory text or a usable example', () => {
		const blockers = groupPublishBlockers(
			{ format: 'CONCEPT_REVIEW', body: '', exampleText: '' },
			{ image: null, audio: null }
		);
		expect(blockers).toEqual([
			'A concept-review group needs non-empty explanatory body text.',
			'A concept-review group needs a usable example.'
		]);
	});

	it('blocks an attached image with no alt text', () => {
		const blockers = groupPublishBlockers(
			{ format: 'READING_PASSAGE', body: 'text', exampleText: null },
			{ image: { altText: '' }, audio: null }
		);
		expect(blockers).toContain(
			'The attached image needs alt text before this group can be published.'
		);
	});
});

describe('group create/patch/publish round trip', () => {
	it('creates a draft group, blocks publication until ready, then publishes', async () => {
		const created = await createGroup(
			db,
			adminId,
			await parseGroupCreateBody(db, validCreateBody({ format: 'LISTENING_CLIP', body: null }))
		);

		let found = await requireGroupDetail(db, created.publicId);
		let dto = groupDetailDto(found);
		expect(dto.status).toBe('DRAFT');
		expect(dto.blockers).toContain('A listening clip group needs an attached audio asset.');

		const current = currentGroupFrom(found.group, found.image, found.audio);
		const patched = await parseGroupPatchBody(db, current, { audioId: audioWithTranscriptId });
		await updateGroup(db, found.group.id, patched);

		found = await requireGroupDetail(db, created.publicId);
		dto = groupDetailDto(found);
		expect(dto.blockers).toEqual([]);

		await setGroupStatus(db, found.group.id, 'PUBLISHED');
		const published = await getGroup(db, created.publicId);
		expect(published?.group.status).toBe('PUBLISHED');
	});

	it('lists groups filtered by format', async () => {
		await createGroup(db, adminId, await parseGroupCreateBody(db, validCreateBody()));
		await createGroup(
			db,
			adminId,
			await parseGroupCreateBody(
				db,
				validCreateBody({ format: 'LISTENING_CLIP', body: null, audioId: audioWithTranscriptId })
			)
		);

		const page = await listGroups(db, { format: 'READING_PASSAGE' });
		expect(page.items).toHaveLength(1);
		expect(page.items[0].format).toBe('READING_PASSAGE');
	});

	it('404s for an unknown group', async () => {
		await expect(requireGroupDetail(db, '01JSEEDDOESNOTEXIST00000000')).rejects.toThrow(ApiProblem);
	});
});
