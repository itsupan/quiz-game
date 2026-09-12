import { apiProblem } from '$lib/features/admin/api/http.server';
import type { Database } from '$lib/server/db';
import { toGroupDetailDto } from './groups-api.server';
import { getGroup } from './groups.server';
import { groupPublishBlockers } from './groups-validation';

/**
 * The group detail load, shared by the read, update and publish/archive endpoints so
 * they can never disagree about a group's media or publish blockers.
 */
export async function requireGroupDetail(db: Database, groupId: string) {
	const found = await getGroup(db, groupId);
	if (!found) {
		apiProblem(
			404,
			'question_group_not_found',
			'Question group not found',
			'That question group does not exist.'
		);
	}

	return found;
}

export function groupDetailDto(found: Awaited<ReturnType<typeof requireGroupDetail>>) {
	const { group, image, audio } = found;
	return toGroupDetailDto({
		group,
		image,
		audio,
		blockers: groupPublishBlockers(
			{ format: group.format, body: group.passageText, exampleText: group.exampleText },
			{ image, audio }
		)
	});
}
