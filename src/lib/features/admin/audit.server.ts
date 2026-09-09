import type { Database } from '$lib/server/db';
import { auditLogs, type AuditAction } from '$lib/server/db/schema';

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
		entityType: 'quiz' | 'question' | 'question_group' | 'media_asset';
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
