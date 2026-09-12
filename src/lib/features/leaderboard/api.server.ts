import { apiProblem, parsePublicId } from '$lib/features/quiz/api/http.server';

export type LeaderboardCursor = {
	totalXp: number;
	userId: string;
	rank: number;
};

export function encodeLeaderboardCursor(cursor: LeaderboardCursor): string {
	return `${cursor.totalXp}.${cursor.rank}.${cursor.userId}`;
}

export function parseLeaderboardCursor(value: string | null): LeaderboardCursor | undefined {
	if (value === null) return undefined;

	const match = /^(\d{1,16})\.(\d{1,16})\.([0-9A-HJKMNP-TV-Z]{26})$/.exec(value);
	if (!match) {
		apiProblem(400, 'invalid_query_parameter', 'Invalid query parameter', 'cursor is invalid.');
	}

	return {
		totalXp: Number(match[1]),
		rank: Number(match[2]),
		userId: parsePublicId(match[3], 'cursor')
	};
}
