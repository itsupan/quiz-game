import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '$lib/domain/enums';
import type { AuditAction, AuditEntityType } from '$lib/domain/enums';
import { listAuditLogs } from '$lib/features/admin/audit.server';
import { enumFilter } from '$lib/features/admin/query-filters';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = {
		action: enumFilter<AuditAction>(url, 'action', AUDIT_ACTIONS),
		entityType: enumFilter<AuditEntityType>(url, 'entityType', AUDIT_ENTITY_TYPES),
		page: Number(url.searchParams.get('page')) || 1
	};

	return { ...(await listAuditLogs(locals.db, filters)), filters };
};
