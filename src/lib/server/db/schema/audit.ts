import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { createdAt } from './columns';

/**
 * Actions worth a trail. Role and status changes are the ones the admin epic requires;
 * content actions get the same treatment because the table costs nothing extra.
 */
export const AUDIT_ACTIONS = [
	'USER_ROLE_CHANGED',
	'USER_STATUS_CHANGED',
	'QUIZ_PUBLISHED',
	'QUIZ_ARCHIVED',
	'QUESTION_PUBLISHED',
	'QUESTION_ARCHIVED',
	'QUESTION_GROUP_ARCHIVED',
	'MEDIA_DELETED'
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Who changed what, when.
 *
 * Deliberately not constrained to `AUDIT_ACTIONS` in SQL: an audit trail should accept
 * a new action name the moment someone writes one, and silently dropping a log entry
 * because of a check constraint would defeat the point of keeping it.
 *
 * `actorUserId` is nullable so scheduled work — the guest purge, expired-attempt
 * reaping — can record itself without impersonating an administrator.
 */
export const auditLogs = sqliteTable(
	'audit_logs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
		action: text('action').notNull(),
		entityType: text('entity_type').notNull(),
		entityId: integer('entity_id').notNull(),
		beforeJson: text('before_json'),
		afterJson: text('after_json'),
		createdAt: createdAt()
	},
	(table) => [
		// "What happened to this quiz?" and "what has this admin been doing?".
		index('audit_logs_entity_idx').on(table.entityType, table.entityId, table.createdAt),
		index('audit_logs_actor_idx').on(table.actorUserId, table.createdAt)
	]
);
