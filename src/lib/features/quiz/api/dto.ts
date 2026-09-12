import type {
	AttemptQuestionGroupView,
	AttemptQuestionView,
	AudioRef,
	ImageRef,
	ResultQuestionGroupView,
	ResultQuestionView,
	AttemptView,
	ResultView,
	ReviewAudioRef
} from '../attempts/types.server';
import { sectionOpen } from '../timing';
import { apiProblem } from './http.server';

function activeSection(view: AttemptView, now: Date) {
	return (
		view.questions.find((question) => sectionOpen(now, view.sectionDeadlines, question.section))
			?.section ?? null
	);
}

function imageDto(image: ImageRef) {
	return image
		? {
				id: image.publicId,
				url: `/media/${image.publicId}`,
				mimeType: image.mimeType,
				width: image.width,
				height: image.height,
				altText: image.altText
			}
		: null;
}

function audioDto(audio: AudioRef | ReviewAudioRef | null) {
	return audio
		? {
				id: audio.publicId,
				url: `/media/${audio.publicId}`,
				mimeType: audio.mimeType,
				durationMs: audio.durationMs,
				...('transcript' in audio ? { transcript: audio.transcript } : {})
			}
		: null;
}

function stimulusDto(group: AttemptQuestionGroupView | ResultQuestionGroupView | null) {
	if (!group) return null;

	return {
		id: group.publicId,
		type: group.format,
		title: group.title,
		instruction: group.instruction,
		body: group.passageText,
		bodyTranslation: group.bodyTranslation,
		example: group.exampleText
			? {
					text: group.exampleText,
					transliteration: group.exampleTransliteration,
					translation: group.exampleTranslation
				}
			: null,
		image: imageDto(group.image),
		audio: audioDto(group.audio)
	};
}

function presentationDto(question: AttemptQuestionView | ResultQuestionView) {
	const prompt = { text: question.stem, translation: question.promptTranslation };

	switch (question.format) {
		case 'VOCABULARY_MEANING':
		case 'KANJI_READING':
			return {
				type: question.format,
				prompt,
				focus: { text: question.focusText, reading: question.focusReading }
			};
		case 'GRAMMAR_CLOZE':
			return {
				type: question.format,
				prompt,
				context: {
					text: question.contextText,
					transliteration: question.contextTransliteration
				},
				studyAid: stimulusDto(question.group)
			};
		case 'READING_COMPREHENSION':
		case 'LISTENING_COMPREHENSION':
			return { type: question.format, prompt, stimulus: stimulusDto(question.group) };
		case 'STANDARD':
			return { type: question.format, prompt };
	}
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
			abandonment: `/api/v1/attempts/${view.attempt.publicId}/abandonment`,
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
		presentation: presentationDto(question),
		image: imageDto(question.image),
		audio: audioDto(question.audio),
		options: question.options.map((option) => ({ number: option.position, body: option.body })),
		selectedOptionNumber:
			question.options.find((option) => option.id === question.selectedOptionId)?.position ?? null,
		progress: {
			current: question.position,
			total: view.questions.length,
			answered: view.questions.filter((entry) => entry.selectedOptionId !== null).length
		},
		canAnswer:
			view.attempt.status === 'IN_PROGRESS' &&
			sectionOpen(now, view.sectionDeadlines, question.section),
		links: {
			attempt: `/api/v1/attempts/${view.attempt.publicId}`,
			answer: `/api/v1/attempts/${view.attempt.publicId}/answers/${question.position}`,
			previous:
				question.position > 1
					? `/api/v1/attempts/${view.attempt.publicId}/questions/${question.position - 1}`
					: null,
			next:
				question.position < view.questions.length
					? `/api/v1/attempts/${view.attempt.publicId}/questions/${question.position + 1}`
					: null
		}
	};
}

export function toResultDto(result: ResultView) {
	const { publicId: quizId, ...quiz } = result.quiz;
	const unansweredCount = result.questions.filter(
		(question) => question.selectedOptionId === null
	).length;
	const correctCount = result.attempt.correctCount ?? 0;
	const questionCount = result.attempt.questionCount ?? result.questions.length;
	const incorrectCount = Math.max(0, questionCount - correctCount - unansweredCount);

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
		reward: { xpAwarded: result.attempt.xpAwarded },
		summary: {
			accuracyPercent: questionCount === 0 ? 0 : Math.round((correctCount / questionCount) * 100),
			correctCount,
			incorrectCount,
			unansweredCount,
			durationMs: result.attempt.durationMs
		},
		bandScores: result.bandScores,
		questions: result.questions.map((question) => ({
			number: question.position,
			section: question.section,
			points: question.points,
			stem: question.stem,
			explanation: question.explanation,
			presentation: presentationDto(question),
			image: imageDto(question.image),
			audio: audioDto(question.audio),
			options: question.options.map((option) => ({ number: option.position, body: option.body })),
			selectedOptionNumber:
				question.options.find((option) => option.id === question.selectedOptionId)?.position ??
				null,
			correctOptionNumber:
				question.options.find((option) => option.id === question.correctOptionId)?.position ?? null,
			isCorrect: question.isCorrect,
			pointsEarned: question.pointsEarned
		})),
		links: {
			attempt: `/api/v1/attempts/${result.attempt.publicId}`,
			quiz: `/api/v1/quizzes/${quizId}`,
			retry: `/api/v1/quizzes/${quizId}/attempts`
		}
	};
}
