import { and, count, eq } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { questions, quizQuestions } from '$lib/server/db/schema';
import type { Quiz, QuizSection } from '$lib/server/db/schema';
import { sectionLimitsFit } from '../timing';

export type PublishableSection = Pick<
	QuizSection,
	'section' | 'position' | 'drawCount' | 'timeLimitSeconds'
> & {
	questionCount: number;
	bankCount: number;
};

export function quizPublishBlockers(
	quiz: Pick<Quiz, 'selectionMode' | 'timeLimitSeconds'>,
	sections: PublishableSection[]
): string[] {
	if (sections.length === 0) return ['Add at least one section before publishing.'];

	const blockers: string[] = [];
	if (quiz.selectionMode === 'FIXED') {
		const empty = sections.filter((section) => section.questionCount === 0);
		if (empty.length > 0) {
			blockers.push(
				`This quiz serves a fixed list, so every section needs at least one question. Empty: ${empty
					.map((section) => section.section)
					.join(', ')}.`
			);
		}
	} else {
		const undrawn = sections.filter((section) => section.drawCount === null);
		if (undrawn.length > 0) {
			blockers.push(
				`This quiz draws its questions at random, so every section needs a draw count. Missing on: ${undrawn
					.map((section) => section.section)
					.join(', ')}.`
			);
		}

		const thin = sections.filter(
			(section) => section.drawCount !== null && section.bankCount < section.drawCount
		);
		if (thin.length > 0) {
			blockers.push(
				`There are not enough published questions to draw from: ${thin
					.map(
						(section) =>
							`${section.section} needs ${section.drawCount}, bank has ${section.bankCount}`
					)
					.join('; ')}.`
			);
		}
	}

	if (!sectionLimitsFit(quiz.timeLimitSeconds, sections)) {
		blockers.push(
			'The section time limits add up to more than the quiz time limit, so the last section would be cut short.'
		);
	}

	return blockers;
}

/**
 * Assembles a quiz's publish blockers end to end: counts the bank and the paper, then
 * runs the pure rule. The admin page load, the publish action, and the admin API all need
 * exactly this, so it lives here once rather than being reassembled at each call site.
 */
export async function quizPublishBlockersFor(
	db: Database,
	quiz: Pick<Quiz, 'id' | 'level' | 'selectionMode' | 'timeLimitSeconds'>,
	sections: Pick<QuizSection, 'id' | 'section' | 'position' | 'drawCount' | 'timeLimitSeconds'>[]
): Promise<string[]> {
	const counts = await sectionPublishCounts(db, quiz, sections);

	return quizPublishBlockers(
		quiz,
		sections.map((section) => ({ ...section, ...counts[section.id] }))
	);
}

export async function sectionPublishCounts(
	db: Database,
	quiz: Pick<Quiz, 'id' | 'level'>,
	sections: Pick<QuizSection, 'id' | 'section'>[]
): Promise<Record<number, { questionCount: number; bankCount: number }>> {
	const counts: Record<number, { questionCount: number; bankCount: number }> = {};
	if (sections.length === 0) return counts;

	const attached = await db
		.select({ quizSectionId: quizQuestions.quizSectionId, total: count() })
		.from(quizQuestions)
		.where(eq(quizQuestions.quizId, quiz.id))
		.groupBy(quizQuestions.quizSectionId);
	const bank = await db
		.select({ section: questions.section, total: count() })
		.from(questions)
		.where(and(eq(questions.level, quiz.level), eq(questions.status, 'PUBLISHED')))
		.groupBy(questions.section);

	for (const section of sections) {
		counts[section.id] = {
			questionCount: attached.find((row) => row.quizSectionId === section.id)?.total ?? 0,
			bankCount: bank.find((row) => row.section === section.section)?.total ?? 0
		};
	}

	return counts;
}
