import type {
	Attempt,
	GroupFormat,
	JlptLevel,
	QuestionFormat,
	Quiz,
	QuizMode,
	ScoringBand,
	Section,
	SelectionMode
} from '$lib/server/db/schema';
import type { FrozenOption } from './questions.server';
import type { SectionDeadline } from '../timing';

export type ImageRef = {
	publicId: string;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	altText: string | null;
} | null;

export type AudioRef = {
	publicId: string;
	mimeType: string | null;
	durationMs: number | null;
} | null;

export type ReviewAudioRef = NonNullable<AudioRef> & { transcript: string | null };

export type AttemptQuestionGroupView = {
	publicId: string;
	format: GroupFormat;
	title: string | null;
	instruction: string | null;
	passageText: string | null;
	bodyTranslation: string | null;
	exampleText: string | null;
	exampleTransliteration: string | null;
	exampleTranslation: string | null;
	image: ImageRef;
	audio: AudioRef;
};

export type ResultQuestionGroupView = Omit<AttemptQuestionGroupView, 'audio'> & {
	audio: ReviewAudioRef | null;
};

export type AttemptQuestionView = {
	attemptQuestionId: number;
	questionId: number;
	section: Section;
	position: number;
	points: number;
	format: QuestionFormat;
	stem: string;
	promptTranslation: string | null;
	focusText: string | null;
	focusReading: string | null;
	contextText: string | null;
	contextTransliteration: string | null;
	group: AttemptQuestionGroupView | null;
	image: ImageRef;
	audio: AudioRef;
	options: FrozenOption[];
	selectedOptionId: number | null;
};

export type AttemptView = {
	attempt: Pick<
		Attempt,
		| 'id'
		| 'publicId'
		| 'userId'
		| 'status'
		| 'startedAt'
		| 'expiresAt'
		| 'showStudyAidsDuringAttempt'
	>;
	quiz: Pick<Quiz, 'id' | 'publicId' | 'title' | 'mode' | 'level' | 'timeLimitSeconds'>;
	sectionDeadlines: SectionDeadline[];
	questions: AttemptQuestionView[];
};

export type ResultQuestionView = AttemptQuestionView & {
	explanation: string | null;
	group: ResultQuestionGroupView | null;
	audio: ReviewAudioRef | null;
	correctOptionId: number | null;
	isCorrect: boolean;
	pointsEarned: number;
};

export type ResultView = {
	attempt: Pick<
		Attempt,
		| 'publicId'
		| 'status'
		| 'startedAt'
		| 'submittedAt'
		| 'durationMs'
		| 'rawScore'
		| 'rawMax'
		| 'correctCount'
		| 'questionCount'
		| 'scaledTotal'
		| 'passed'
		| 'xpAwarded'
	>;
	quiz: Pick<Quiz, 'publicId' | 'title' | 'mode' | 'level' | 'scaledTotalMax' | 'passMarkTotal'>;
	bandScores: {
		bandCode: ScoringBand;
		label: string;
		scaledScore: number;
		scaledMax: number;
		passMark: number | null;
		passed: boolean | null;
	}[];
	questions: ResultQuestionView[];
};

export type QuizOverviewSection = {
	section: Section;
	position: number;
	timeLimitSeconds: number | null;
	questionCount: number;
};

export type QuizOverview = {
	id: number;
	publicId: string;
	title: string;
	description: string | null;
	mode: QuizMode;
	level: JlptLevel;
	selectionMode: SelectionMode;
	icon: Quiz['icon'];
	timeLimitSeconds: number | null;
	sections: QuizOverviewSection[];
};
