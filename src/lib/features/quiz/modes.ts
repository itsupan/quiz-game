import type { QuizMode } from '$lib/domain/enums';

/**
 * The one predicate that decides whether a sitting gets game feel.
 *
 * `mode` used to be display-only — a `<Badge>` on the quiz brief and the result page, and
 * nothing more. This is the first behaviour that branches on it, so it branches in exactly
 * one place: read this function to know what practice mode changes, rather than grepping
 * for a string literal across the client and the server.
 *
 * Practice is a kata — instant verdicts, a combo meter, speed bonuses, a celebration at the
 * end. `MOCK_TEST` and `FULL_EXAM` are a sitting, and must keep behaving exactly as they did
 * before any of that existed: silent saves, no reveal until the result page, and a score
 * that owes nothing to how fast anyone typed. That fidelity is the product's credibility as
 * exam prep, so it is worth one indirection to make breaking it hard to do by accident.
 */
export function isPracticeMode(mode: QuizMode): boolean {
	return mode === 'JLPT_PRACTICE';
}
