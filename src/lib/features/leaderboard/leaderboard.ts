/** Every 1,000 lifetime XP earns one level, capped at LEVEL_CAP ("50 MAX" on the card). */
const XP_PER_LEVEL = 1000;
export const LEVEL_CAP = 50;

export function computeLevel(totalXp: number): number {
	return Math.min(LEVEL_CAP, Math.floor(totalXp / XP_PER_LEVEL) + 1);
}

/**
 * Consecutive calendar days (UTC) up to and including today or yesterday that have at
 * least one submitted attempt. `dates` need not be sorted or deduplicated.
 */
export function computeStreak(dates: Date[], now: Date): number {
	const days = new Set(dates.map((date) => Math.floor(date.getTime() / 86_400_000)));
	const today = Math.floor(now.getTime() / 86_400_000);

	let cursor = days.has(today) ? today : today - 1;
	if (!days.has(cursor)) return 0;

	let streak = 0;
	while (days.has(cursor)) {
		streak += 1;
		cursor -= 1;
	}

	return streak;
}

export type LeaderboardEntry = {
	rank: number;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	level: number;
	totalXp: number;
	streak: number;
};
