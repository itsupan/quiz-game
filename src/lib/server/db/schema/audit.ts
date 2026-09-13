import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '$lib/domain/enums';
import { users } from './auth';
import { createdAt } from './columns';

// Re-exported so existing server-side callers can keep importing these from
// `$lib/server/db/schema` alongside the table itself; `$lib/domain/enums` is the source
// of truth because the System Logs filter UI needs them too, and that file must stay
// importable from client code.
export { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES };
export type { AuditAction, AuditEntityType } from '$lib/domain/enums';

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
