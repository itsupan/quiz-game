import type { Section } from '$lib/domain/enums';
import type { Quiz, QuizSection } from '$lib/server/db/schema';
import type { AttachedQuestion } from './paper.server';
import type { QuizListItem } from './quiz-store.server';

export function toQuizListItemDto(item: QuizListItem) {
	return {
		id: item.publicId,
		title: item.title,
		mode: item.mode,
		level: item.level,
		selectionMode: item.selectionMode,
		icon: item.icon,
		status: item.status,
		timeLimitSeconds: item.timeLimitSeconds,
		sectionCount: item.sectionCount,
		questionCount: item.questionCount,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString()
	};
}

function toSectionDto(
	section: QuizSection,
	counts: Record<number, { questionCount: number; bankCount: number }>
) {
	return {
		section: section.section,
		position: section.position,
		timeLimitSeconds: section.timeLimitSeconds,
		drawCount: section.drawCount,
		questionCount: counts[section.id]?.questionCount ?? 0,
		bankCount: counts[section.id]?.bankCount ?? 0
	};
}

function bySectionEnum(sections: Pick<QuizSection, 'id' | 'section'>[]) {
	return new Map(sections.map((section) => [section.id, section.section]));
}

export function toAttachedQuestionDtos(
	attached: AttachedQuestion[],
	sections: Pick<QuizSection, 'id' | 'section'>[]
) {
	const sectionById = bySectionEnum(sections);

	return attached.map((question) => ({
		questionId: question.publicId,
		section: sectionById.get(question.quizSectionId) as Section,
		stem: question.stem,
		position: question.position,
		points: question.points,
		status: question.status
	}));
}

export function toAttachableDto(
	attachable: Record<number, { publicId: string; stem: string }[]>,
	sections: Pick<QuizSection, 'id' | 'section'>[]
) {
	const sectionById = bySectionEnum(sections);

	return Object.fromEntries(
		Object.entries(attachable).map(([sectionId, list]) => [
			sectionById.get(Number(sectionId)),
			list.map((question) => ({ questionId: question.publicId, stem: question.stem }))
		])
	);
}

export function toQuizDetailDto(input: {
	quiz: Quiz;
	sections: QuizSection[];
	counts: Record<number, { questionCount: number; bankCount: number }>;
	attached: AttachedQuestion[];
	attachable: Record<number, { publicId: string; stem: string }[]>;
	blockers: string[];
}) {
	return {
		id: input.quiz.publicId,
		title: input.quiz.title,
		description: input.quiz.description,
		mode: input.quiz.mode,
		level: input.quiz.level,
		selectionMode: input.quiz.selectionMode,
		icon: input.quiz.icon,
		status: input.quiz.status,
		timeLimitSeconds: input.quiz.timeLimitSeconds,
		scaledTotalMax: input.quiz.scaledTotalMax,
		passMarkTotal: input.quiz.passMarkTotal,
		showStudyAidsDuringAttempt: input.quiz.showStudyAidsDuringAttempt,
		xpReward: input.quiz.xpReward,
		publishedAt: input.quiz.publishedAt?.toISOString() ?? null,
		createdAt: input.quiz.createdAt.toISOString(),
		updatedAt: input.quiz.updatedAt.toISOString(),
		sections: input.sections.map((section) => toSectionDto(section, input.counts)),
		attached: toAttachedQuestionDtos(input.attached, input.sections),
		attachable: toAttachableDto(input.attachable, input.sections),
		blockers: input.blockers
	};
}
