import type { Section } from '$lib/domain/enums';

/**
 * The clock rules for a timed attempt.
 *
 * Pure on purpose: `now` is always a parameter, never `Date.now()`, so expiry is
 * exhaustively testable without waiting and without a database. The server calls these
 * with its own clock; the browser calls them only to render a countdown, which is display
 * only — `attempts.expires_at` is the authority, as the schema decisions record.
 *
 * There is no pause. A JLPT sitting does not pause, so neither does this: the clock runs
 * from `started_at` to expiry whether or not the tab is open. That policy is the reason
 * nothing here needs a column the schema does not already have.
 */

/** One section's configured limit, as stored on `quiz_sections`. */
export type SectionLimit = {
	section: Section;
	position: number;
	timeLimitSeconds: number | null;
};

/** A section and the instant it stops accepting answers. Null means that section is untimed. */
export type SectionDeadline = {
	section: Section;
	deadline: Date | null;
};

/**
 * When the whole attempt ends.
 *
 * Null `timeLimitSeconds` means untimed, which is what a JLPT_PRACTICE drill usually is.
 */
export function attemptDeadline(startedAt: Date, timeLimitSeconds: number | null): Date | null {
	if (timeLimitSeconds === null) {
		return null;
	}

	return new Date(startedAt.getTime() + timeLimitSeconds * 1000);
}

/**
 * When each section ends, accumulated from the start of the attempt in `position` order.
 *
 * A real exam paper runs its sections back to back on one clock: finishing the vocabulary
 * section early does not buy you extra time for reading. So section *k* ends at
 * `startedAt + Σ(limits of sections 1..k)` — which is also exactly what the seeded N4 exam
 * encodes, its 1500 + 3300 + 2100 summing to the quiz's own 6900 second limit. Deriving it
 * this way means no per-section start has to be stored.
 *
 * A section with no limit is untimed, and so is every section after it: once one section
 * can run indefinitely there is no instant to accumulate from, and inventing one would
 * cut a later section short for a reason the learner was never shown.
 */
export function sectionDeadlines(
	startedAt: Date,
	expiresAt: Date | null,
	sections: SectionLimit[]
): SectionDeadline[] {
	const ordered = [...sections].sort((a, b) => a.position - b.position);

	let elapsedSeconds = 0;
	let untimedFromHere = false;

	return ordered.map(({ section, timeLimitSeconds }) => {
		if (untimedFromHere || timeLimitSeconds === null) {
			untimedFromHere = true;

			// An untimed section still ends when the attempt does, if the attempt ends.
			return { section, deadline: expiresAt };
		}

		elapsedSeconds += timeLimitSeconds;
		const deadline = new Date(startedAt.getTime() + elapsedSeconds * 1000);

		// The attempt's own limit is the outer bound and always wins. `sectionLimitsFit`
		// stops the two disagreeing at publish time; this clamp is for content that was
		// already published, where a section clock running past the end of the sitting
		// would show a learner time they do not have.
		if (expiresAt !== null && deadline.getTime() > expiresAt.getTime()) {
			return { section, deadline: expiresAt };
		}

		return { section, deadline };
	});
}

/**
 * Whether a quiz's section limits fit inside its own time limit.
 *
 * Used as a publish blocker. Sections that sum past the quiz limit are not a rendering
 * problem — they are a promise the sitting cannot keep, and the last section would be
 * silently cut short. An untimed quiz has nothing to overrun; a null section limit
 * contributes nothing to the sum, because it is bounded by the attempt rather than itself.
 */
export function sectionLimitsFit(
	quizTimeLimitSeconds: number | null,
	sections: SectionLimit[]
): boolean {
	if (quizTimeLimitSeconds === null) {
		return true;
	}

	const total = sections.reduce((sum, section) => sum + (section.timeLimitSeconds ?? 0), 0);

	return total <= quizTimeLimitSeconds;
}

/** Milliseconds left on a deadline, floored at zero. Null when there is no deadline. */
export function remainingMs(now: Date, deadline: Date | null): number | null {
	if (deadline === null) {
		return null;
	}

	return Math.max(0, deadline.getTime() - now.getTime());
}

/**
 * Whether a deadline has passed.
 *
 * The boundary counts as expired: at exactly `expires_at` the time allowed has been used
 * up, and treating that instant as still open would let a request that arrives on the
 * millisecond write an answer the clock no longer covers.
 */
export function isExpired(now: Date, deadline: Date | null): boolean {
	if (deadline === null) {
		return false;
	}

	return now.getTime() >= deadline.getTime();
}

/**
 * Whether a section still accepts answers.
 *
 * A section can close while the attempt as a whole is still open — that is the whole point
 * of per-section limits. A section the quiz does not configure is treated as open; the
 * attempt's own deadline is checked separately and governs regardless.
 */
export function sectionOpen(now: Date, deadlines: SectionDeadline[], section: Section): boolean {
	const match = deadlines.find((entry) => entry.section === section);

	if (!match) {
		return true;
	}

	return !isExpired(now, match.deadline);
}
