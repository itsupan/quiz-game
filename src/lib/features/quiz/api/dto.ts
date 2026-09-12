import type { AttemptView, ResultView } from '../attempts/types.server';
import { sectionOpen } from '../timing';
import { apiProblem } from './http.server';

function activeSection(view: AttemptView, now: Date) {
	return (
		view.questions.find((question) => sectionOpen(now, view.sectionDeadlines, question.section))
			?.section ?? null
	);
}

export function toAttemptDto(view: AttemptView, now: Date) {
	const section = view.attempt.status === 'IN_PROGRESS' ? activeSection(view, now) : null;
	const sectionDeadline = section
		? (view.sectionDeadlines.find((entry) => entry.section === section)?.deadline ?? null)
		: null;

	return {
		id: view.attempt.publicId,
		status: view.attempt.status,
		serverTime: now.toISOString(),
		startedAt: view.attempt.startedAt.toISOString(),
		attemptExpiresAt: view.attempt.expiresAt?.toISOString() ?? null,
		activeSection: section,
		sectionExpiresAt: sectionDeadline?.toISOString() ?? null,
		quiz: {
			id: view.quiz.publicId,
			title: view.quiz.title,
			mode: view.quiz.mode,
			level: view.quiz.level
		},
		progress: {
			answered: view.questions.filter((question) => question.selectedOptionId !== null).length,
			total: view.questions.length
		},
		sections: view.sectionDeadlines.map((entry) => ({
			name: entry.section,
			expiresAt: entry.deadline?.toISOString() ?? null,
			open:
				view.attempt.status === 'IN_PROGRESS' &&
				sectionOpen(now, view.sectionDeadlines, entry.section)
		})),
		questions: view.questions.map((question) => ({
			number: question.position,
			section: question.section,
			answered: question.selectedOptionId !== null,
			href: `/api/v1/attempts/${view.attempt.publicId}/questions/${question.position}`
		})),
		links: {
			self: `/api/v1/attempts/${view.attempt.publicId}`,
			submission: `/api/v1/attempts/${view.attempt.publicId}/submission`,
			result: `/api/v1/attempts/${view.attempt.publicId}/result`
		}
	};
}

export function toQuestionDto(view: AttemptView, questionNumber: number, now: Date) {
	const question = view.questions.find((entry) => entry.position === questionNumber);
	if (!question) {
		apiProblem(
			404,
			'question_not_found',
			'Question not found',
			'That question was not served in this attempt.'
		);
	}

	return {
		attemptId: view.attempt.publicId,
		attemptStatus: view.attempt.status,
		serverTime: now.toISOString(),
		number: question.position,
		section: question.section,
		points: question.points,
		stem: question.stem,
		image: question.image
			? {
					id: question.image.publicId,
					url: `/media/${question.image.publicId}`,
					altText: question.image.altText
				}
			: null,
		audio: question.audio
			? { id: question.audio.publicId, url: `/media/${question.audio.publicId}` }
			: null,
		options: question.options.map((option) => ({ number: option.position, body: option.body })),
		selectedOptionNumber:
			question.options.find((option) => option.id === question.selectedOptionId)?.position ?? null,
		canAnswer:
			view.attempt.status === 'IN_PROGRESS' &&
			sectionOpen(now, view.sectionDeadlines, question.section),
		links: {
			attempt: `/api/v1/attempts/${view.attempt.publicId}`,
			answer: `/api/v1/attempts/${view.attempt.publicId}/answers/${question.position}`
		}
	};
}

export function toResultDto(result: ResultView) {
	const { publicId: quizId, ...quiz } = result.quiz;

	return {
		attempt: {
			id: result.attempt.publicId,
			status: result.attempt.status,
			startedAt: result.attempt.startedAt.toISOString(),
			submittedAt: result.attempt.submittedAt?.toISOString() ?? null,
			durationMs: result.attempt.durationMs,
			rawScore: result.attempt.rawScore,
			rawMax: result.attempt.rawMax,
			correctCount: result.attempt.correctCount,
			questionCount: result.attempt.questionCount,
			scaledTotal: result.attempt.scaledTotal,
			passed: result.attempt.passed
		},
		quiz: { id: quizId, ...quiz },
		bandScores: result.bandScores,
		questions: result.questions.map((question) => ({
			number: question.position,
			section: question.section,
			points: question.points,
			stem: question.stem,
			explanation: question.explanation,
			image: question.image
				? {
						id: question.image.publicId,
						url: `/media/${question.image.publicId}`,
						altText: question.image.altText
					}
				: null,
			audio: question.audio
				? {
						id: question.audio.publicId,
						url: `/media/${question.audio.publicId}`,
						transcript: question.audio.transcript
					}
				: null,
			options: question.options.map((option) => ({ number: option.position, body: option.body })),
			selectedOptionNumber:
				question.options.find((option) => option.id === question.selectedOptionId)?.position ??
				null,
			correctOptionNumber:
				question.options.find((option) => option.id === question.correctOptionId)?.position ?? null,
			isCorrect: question.isCorrect,
			pointsEarned: question.pointsEarned
		})),
		links: { attempt: `/api/v1/attempts/${result.attempt.publicId}` }
	};
}
