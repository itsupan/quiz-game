import { and, count, desc, eq, inArray } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { mediaAssets, questionGroups } from '$lib/server/db/schema';
import type { ContentStatus, GroupFormat, JlptLevel, Section } from '$lib/server/db/schema';
import type { GroupInput } from './groups-validation';

export type GroupListItem = {
	publicId: string;
	level: JlptLevel;
	section: Section;
	format: GroupFormat;
	title: string | null;
	status: ContentStatus;
	createdAt: Date;
	updatedAt: Date;
};

export type GroupFilters = {
	level?: JlptLevel;
	section?: Section;
	status?: ContentStatus;
	format?: GroupFormat;
	page?: number;
	/** Defaults to `PAGE_SIZE`. The admin dashboard never overrides this; the JSON API does. */
	limit?: number;
};

export const PAGE_SIZE = 25;

export async function listGroups(db: Database, filters: GroupFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const limit = filters.limit ?? PAGE_SIZE;

	const where = and(
		filters.level ? eq(questionGroups.level, filters.level) : undefined,
		filters.section ? eq(questionGroups.section, filters.section) : undefined,
		filters.status ? eq(questionGroups.status, filters.status) : undefined,
		filters.format ? eq(questionGroups.format, filters.format) : undefined
	);

	const items = await db
		.select({
			publicId: questionGroups.publicId,
			level: questionGroups.level,
			section: questionGroups.section,
			format: questionGroups.format,
			title: questionGroups.title,
			status: questionGroups.status,
			createdAt: questionGroups.createdAt,
			updatedAt: questionGroups.updatedAt
		})
		.from(questionGroups)
		.where(where)
		.orderBy(desc(questionGroups.updatedAt))
		.limit(limit)
		.offset((page - 1) * limit);

	const [{ total }] = await db.select({ total: count() }).from(questionGroups).where(where);

	return { items, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

/** A light lookup for callers that only need to resolve a public id, such as attaching a question to a group. */
export async function getGroupRefByPublicId(db: Database, publicId: string) {
	const [group] = await db
		.select({
			id: questionGroups.id,
			publicId: questionGroups.publicId,
			level: questionGroups.level,
			section: questionGroups.section,
			format: questionGroups.format,
			status: questionGroups.status
		})
		.from(questionGroups)
		.where(eq(questionGroups.publicId, publicId));

	return group ?? null;
}

export async function getGroup(db: Database, publicId: string) {
	const [group] = await db
		.select()
		.from(questionGroups)
		.where(eq(questionGroups.publicId, publicId));

	if (!group) {
		return null;
	}

	const attachedIds = [group.imageMediaId, group.audioMediaId].filter(
		(id): id is number => id !== null
	);

	const media = attachedIds.length
		? await db.select().from(mediaAssets).where(inArray(mediaAssets.id, attachedIds))
		: [];

	return {
		group,
		image: media.find((asset) => asset.id === group.imageMediaId) ?? null,
		audio: media.find((asset) => asset.id === group.audioMediaId) ?? null
	};
}

export async function createGroup(
	db: Database,
	actorUserId: number | null,
	input: GroupInput
): Promise<{ id: number; publicId: string }> {
	const [created] = await db
		.insert(questionGroups)
		.values({
			level: input.level,
			section: input.section,
			format: input.format,
			title: input.title,
			passageText: input.body,
			instruction: input.instruction,
			bodyTranslation: input.bodyTranslation,
			exampleText: input.exampleText,
			exampleTransliteration: input.exampleTransliteration,
			exampleTranslation: input.exampleTranslation,
			imageMediaId: input.imageMediaId,
			audioMediaId: input.audioMediaId,
			createdBy: actorUserId
		})
		.returning({ id: questionGroups.id, publicId: questionGroups.publicId });

	return created;
}

export async function updateGroup(db: Database, groupId: number, input: GroupInput): Promise<void> {
	await db
		.update(questionGroups)
		.set({
			level: input.level,
			section: input.section,
			format: input.format,
			title: input.title,
			passageText: input.body,
			instruction: input.instruction,
			bodyTranslation: input.bodyTranslation,
			exampleText: input.exampleText,
			exampleTransliteration: input.exampleTransliteration,
			exampleTranslation: input.exampleTranslation,
			imageMediaId: input.imageMediaId,
			audioMediaId: input.audioMediaId
		})
		.where(eq(questionGroups.id, groupId));
}

export async function setGroupStatus(
	db: Database,
	groupId: number,
	status: ContentStatus
): Promise<void> {
	await db.update(questionGroups).set({ status }).where(eq(questionGroups.id, groupId));
}
