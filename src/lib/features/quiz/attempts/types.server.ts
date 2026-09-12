import type {
	Attempt,
	JlptLevel,
	Quiz,
	QuizMode,
	ScoringBand,
	Section,
	SelectionMode
} from '$lib/server/db/schema';
import type { FrozenOption } from './questions.server';
import type { SectionDeadline } from '../timing';

type MediaRef = { publicId: string; altText: string | null } | null;
type AudioRef = { publicId: string; transcript: string | null } | null;

export type AttemptQuestionView = {
	attemptQuestionId: number;
	questionId: number;
	section: Section;
	position: number;
	points: number;
	stem: string;
	image: MediaRef;
	audio: AudioRef;
	options: FrozenOption[];
	selectedOptionId: number | null;
};

export type AttemptView = {
	attempt: Pick<Attempt, 'id' | 'publicId' | 'userId' | 'status' | 'startedAt' | 'expiresAt'>;
	quiz: Pick<Quiz, 'id' | 'publicId' | 'title' | 'mode' | 'level' | 'timeLimitSeconds'>;
	sectionDeadlines: SectionDeadline[];
	questions: AttemptQuestionView[];
};

export type ResultQuestionView = AttemptQuestionView & {
	explanation: string | null;
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
	timeLimitSeconds: number | null;
	sections: QuizOverviewSection[];
};
