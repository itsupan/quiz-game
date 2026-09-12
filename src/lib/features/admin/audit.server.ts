import { and, count, desc, eq, sql } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import {
	auditLogs,
	mediaAssets,
	questionGroups,
	questions,
	quizzes,
	users,
	type AuditAction,
	type AuditEntityType
} from '$lib/server/db/schema';

export type AuditFilters = {
	action?: AuditAction;
	entityType?: AuditEntityType;
	page?: number;
	limit?: number;
};

export const AUDIT_PAGE_SIZE = 25;

function parsedJson(value: string | null): unknown {
	if (value === null) return null;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

/** Reads audit entries with the actor and a human-meaningful target label. */
export async function listAuditLogs(db: Database, filters: AuditFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const limit = filters.limit ?? AUDIT_PAGE_SIZE;
	const where = and(
		filters.action ? eq(auditLogs.action, filters.action) : undefined,
		filters.entityType ? eq(auditLogs.entityType, filters.entityType) : undefined
	);

	const entityLabel = sql<string>`case ${auditLogs.entityType}
		when 'quiz' then coalesce(
			(select ${quizzes.title} from ${quizzes} where ${quizzes.id} = ${auditLogs.entityId}),
			'Quiz #' || ${auditLogs.entityId}
		)
		when 'question' then coalesce(
			(select ${questions.stem} from ${questions} where ${questions.id} = ${auditLogs.entityId}),
			'Question #' || ${auditLogs.entityId}
		)
		when 'question_group' then coalesce(
			(select ${questionGroups.title} from ${questionGroups}
				where ${questionGroups.id} = ${auditLogs.entityId}),
			'Question group #' || ${auditLogs.entityId}
		)
		when 'media_asset' then coalesce(
			(select ${mediaAssets.originalFilename} from ${mediaAssets}
				where ${mediaAssets.id} = ${auditLogs.entityId}),
			'Media #' || ${auditLogs.entityId}
		)
		when 'user' then coalesce(
			(select ${users.displayName} from ${users} where ${users.id} = ${auditLogs.entityId}),
			'User #' || ${auditLogs.entityId}
		)
		else ${auditLogs.entityType} || ' #' || ${auditLogs.entityId}
	end`;
	const entityPublicId = sql<string | null>`case ${auditLogs.entityType}
		when 'quiz' then (select ${quizzes.publicId} from ${quizzes}
			where ${quizzes.id} = ${auditLogs.entityId})
		when 'question' then (select ${questions.publicId} from ${questions}
			where ${questions.id} = ${auditLogs.entityId})
		when 'question_group' then (select ${questionGroups.publicId} from ${questionGroups}
			where ${questionGroups.id} = ${auditLogs.entityId})
		when 'media_asset' then (select ${mediaAssets.publicId} from ${mediaAssets}
			where ${mediaAssets.id} = ${auditLogs.entityId})
		when 'user' then (select ${users.publicId} from ${users}
			where ${users.id} = ${auditLogs.entityId})
		else null
	end`;

	const rows = await db
		.select({
			id: auditLogs.id,
			action: auditLogs.action,
			entityType: auditLogs.entityType,
			entityId: auditLogs.entityId,
			entityLabel,
			entityPublicId,
			actorId: users.publicId,
			actorName: users.displayName,
			beforeJson: auditLogs.beforeJson,
			afterJson: auditLogs.afterJson,
			createdAt: auditLogs.createdAt
		})
		.from(auditLogs)
		.leftJoin(users, eq(users.id, auditLogs.actorUserId))
		.where(where)
		.orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
		.limit(limit)
		.offset((page - 1) * limit);

	const [{ total }] = await db.select({ total: count() }).from(auditLogs).where(where);

	return {
		items: rows.map(({ beforeJson, afterJson, ...row }) => ({
			...row,
			before: parsedJson(beforeJson),
			after: parsedJson(afterJson)
		})),
		total,
		page,
		pageCount: Math.max(1, Math.ceil(total / limit))
	};
}

/**
 * Writes one row to the audit trail.
 *
 * `audit_logs` is deliberately unconstrained in SQL so a new action name is never
 * dropped, which puts the burden here: pass an action from `AUDIT_ACTIONS` and the
 * before/after shape of the row that changed.
 *
 * Failing to write an audit entry must not fail the operation it describes — an admin
 * whose publish half-succeeded is worse than a gap in the log — so this never throws.
 */
export async function recordAudit(
	db: Database,
	entry: {
		actorUserId: number | null;
		action: AuditAction;
		entityType: AuditEntityType;
		entityId: number;
		before?: unknown;
		after?: unknown;
	}
): Promise<void> {
	try {
		await db.insert(auditLogs).values({
			actorUserId: entry.actorUserId,
			action: entry.action,
			entityType: entry.entityType,
			entityId: entry.entityId,
			beforeJson: entry.before === undefined ? null : JSON.stringify(entry.before),
			afterJson: entry.after === undefined ? null : JSON.stringify(entry.after)
		});
	} catch (cause) {
		console.error(
			'[audit] failed to record %s on %s %d',
			entry.action,
			entry.entityType,
			entry.entityId,
			cause
		);
	}
}
