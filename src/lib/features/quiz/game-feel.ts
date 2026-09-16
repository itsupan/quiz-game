/**
 * Every rule that makes a practice run feel like a game, and none that decide a JLPT score.
 *
 * This module is the firewall. `scoring.ts` owns what an answer is worth on the exam and
 * does not import anything from here; nothing here is allowed to reach `rawScore`,
 * `scaledTotal`, a band score or `passed`. The only thing these numbers may touch is
 * `xp_awarded`, which is a motivational currency for the leaderboard, not a result.
 *
 * If a term from this file ever needs to appear in `scoring.ts`, that is the moment the
 * product stops being able to claim its scores approximate a real sitting. Do not.
 *
 * Pure, so the rules can be reasoned about and changed without touching D1.
 */

/** Streak lengths worth marking. The meter escalates as each is passed. */
export const COMBO_THRESHOLDS = [3, 5, 10] as const;

export function comboTier(combo: number): 0 | 1 | 2 | 3 {
	if (combo >= COMBO_THRESHOLDS[2]) return 3;
	if (combo >= COMBO_THRESHOLDS[1]) return 2;
	if (combo >= COMBO_THRESHOLDS[0]) return 1;
	return 0;
}

/**
 * Below this, an answer was not read — it was scripted, or it was a stray double-tap.
 * It still counts as correct; it just earns no speed bonus.
 */
export const MIN_ELAPSED_MS = 250;

/** Past this, the learner was not thinking about the question; they were away from it. */
export const FULL_BONUS_MS = 4_000;
export const NO_BONUS_MS = 25_000;

/** A sitting's speed bonus can never exceed this share of the quiz's own XP reward. */
export const BONUS_XP_CAP_RATIO = 0.5;

/**
 * How much of a question's points a fast, correct answer adds as bonus XP.
 *
 * Tapers linearly from full at `FULL_BONUS_MS` to nothing at `NO_BONUS_MS`, so there is no
 * cliff to game and no reward for frantic guessing — a wrong answer earns zero however
 * fast it arrives, because the caller only applies this to correct ones.
 */
export function speedFactor(elapsedMs: number | null): number {
	if (elapsedMs === null || elapsedMs < MIN_ELAPSED_MS) return 0;
	if (elapsedMs <= FULL_BONUS_MS) return 1;
	if (elapsedMs >= NO_BONUS_MS) return 0;

	return (NO_BONUS_MS - elapsedMs) / (NO_BONUS_MS - FULL_BONUS_MS);
}

/**
 * Clamps a client-reported answer time against what the server can actually vouch for.
 *
 * The browser is the only place that knows when the question became answerable — when the
 * paint landed, or when a listening clip's readiness gate opened — so it reports the
 * interval. That makes the raw number spoofable, and it is accepted anyway for one reason:
 * the worst case is inflated bonus XP on a friendly leaderboard in a single-player study
 * app. It cannot move a JLPT score, because no value from this module is ever passed to
 * `scoreAttempt`.
 *
 * The ceiling is the honest part: a claim cannot be smaller than zero, and cannot exceed the
 * wall-clock time that has actually passed since the attempt started or since the previous
 * answer landed. That removes both tails without pretending to trust the middle.
 */
export function clampElapsedMs(claimed: unknown, serverCeilingMs: number): number | null {
	if (typeof claimed !== 'number' || !Number.isFinite(claimed) || claimed < 0) return null;

	const ceiling = Math.max(0, Math.min(serverCeilingMs, NO_BONUS_MS));
	return Math.min(Math.round(claimed), ceiling);
}

/**
 * The bonus XP a single correct answer earned.
 *
 * Scaled by the question's own points so a question worth more is worth more to answer
 * quickly, and by the streak in progress so a run compounds. Rounded down: a bonus that
 * rounds up can exceed the cap by a point per question across a long quiz.
 */
export function speedBonusXp(elapsedMs: number | null, points: number, combo: number): number {
	const factor = speedFactor(elapsedMs);
	if (factor === 0) return 0;

	const comboMultiplier = 1 + comboTier(combo) * 0.25;
	return Math.floor(points * factor * comboMultiplier);
}
